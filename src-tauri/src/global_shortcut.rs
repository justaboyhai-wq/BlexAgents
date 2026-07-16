// Global shortcut: summon-or-toggle BlexAgent from anywhere on the OS.
//
// Behaviour:
//   window visible + focused  →  hide to tray (Raycast-style toggle)
//   otherwise                 →  show + unminimize + focus
//
// Deliberately does NOT auto-create a Launcher tab or move keyboard focus —
// the user found that surprising in dogfooding (PRD revision 2026-05-15).
// The shortcut is now purely a window visibility toggle; whichever tab was
// active before stays active.
//
// Pit-of-success: we DO NOT reimplement show + unminimize + set_focus here.
// `tray::show_main_window` is the single canonical "raise window" entry point
// (lib.rs:185, tray.rs:111). Tray click / single-instance / toast click / global
// shortcut all funnel through it. If you find yourself duplicating those three
// calls, you forgot why.

use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::sync::atomic::{AtomicIsize, AtomicU64, Ordering};
use std::sync::Mutex;
use tauri::{
    AppHandle, Emitter, LogicalPosition, Manager, Runtime, WebviewUrl, WebviewWindowBuilder,
};
use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Modifiers, Shortcut, ShortcutState};

use crate::{ulog_error, ulog_info, ulog_warn};

/// Canonical default; M = BlexAgent, three-platform-safe.
pub const DEFAULT_ACCELERATOR: &str = "CmdOrCtrl+Shift+M";
#[cfg(target_os = "windows")]
pub const DEFAULT_VOICE_ACCELERATOR: &str = "LingjiAI";
#[cfg(not(target_os = "windows"))]
pub const DEFAULT_VOICE_ACCELERATOR: &str = "MouseX1";

/// AppConfig.globalSummonShortcut shape — mirror of TS type in shared/config-types.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GlobalSummonConfig {
    pub enabled: bool,
    pub accelerator: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GlobalVoiceConfig {
    pub enabled: bool,
    pub accelerator: String,
}

impl Default for GlobalVoiceConfig {
    fn default() -> Self {
        Self {
            enabled: true,
            accelerator: DEFAULT_VOICE_ACCELERATOR.to_string(),
        }
    }
}

impl Default for GlobalSummonConfig {
    fn default() -> Self {
        Self {
            enabled: true,
            accelerator: DEFAULT_ACCELERATOR.to_string(),
        }
    }
}

/// Track the currently-registered accelerator so toggling enabled/changing key
/// knows what to unregister. Wrapped in a Mutex because Tauri commands run on
/// arbitrary worker threads.
static CURRENT_ACCELERATOR: Mutex<Option<String>> = Mutex::new(None);
static CURRENT_VOICE_ACCELERATOR: Mutex<Option<String>> = Mutex::new(None);

#[derive(Debug, Clone, Copy)]
struct VoiceWakeRuntimeState {
    surface: Option<&'static str>,
    held: bool,
    revision: u64,
}

static CURRENT_VOICE_STATE: Mutex<VoiceWakeRuntimeState> = Mutex::new(VoiceWakeRuntimeState {
    surface: None,
    held: false,
    revision: 0,
});
static VOICE_POLL_GENERATION: AtomicU64 = AtomicU64::new(0);
#[cfg(target_os = "windows")]
static DICTATION_TARGET_WINDOW: AtomicIsize = AtomicIsize::new(0);

#[cfg(target_os = "windows")]
fn on_dictation_pressed<R: Runtime>(app: &AppHandle<R>) {
    use windows_sys::Win32::UI::WindowsAndMessaging::GetForegroundWindow;
    let target = unsafe { GetForegroundWindow() };
    DICTATION_TARGET_WINDOW.store(target as isize, Ordering::Relaxed);
    emit_voice_capsule_recording_state(app, "dictation");
    if let Err(error) = ensure_voice_capsule(app, "dictation") {
        ulog_error!("{}", error);
    }
    let _ = app.emit("global-dictation-start", ());
    ulog_info!(
        "[global-shortcut] Lingji dictation start target={:?}",
        target
    );
}

#[cfg(target_os = "windows")]
fn on_dictation_released<R: Runtime>(app: &AppHandle<R>) {
    let _ = app.emit("global-dictation-stop", ());
    ulog_info!("[global-shortcut] Lingji dictation stop");
}

#[cfg(target_os = "windows")]
#[tauri::command]
pub fn cmd_insert_global_dictation_text(
    text: String,
    replace_characters: Option<u32>,
    finalize: Option<bool>,
) -> Result<(), String> {
    use std::mem::size_of;
    use windows_sys::Win32::Foundation::HWND;
    use windows_sys::Win32::UI::Input::KeyboardAndMouse::{
        SendInput, INPUT, INPUT_0, INPUT_KEYBOARD, KEYBDINPUT, KEYEVENTF_KEYUP, KEYEVENTF_UNICODE,
        VK_BACK,
    };
    use windows_sys::Win32::UI::WindowsAndMessaging::{IsWindow, SetForegroundWindow};

    let finalize = finalize.unwrap_or(true);
    let target = if finalize {
        DICTATION_TARGET_WINDOW.swap(0, Ordering::Relaxed)
    } else {
        DICTATION_TARGET_WINDOW.load(Ordering::Relaxed)
    } as HWND;
    if target.is_null() || unsafe { IsWindow(target) } == 0 {
        return Err("Global dictation target is no longer available.".to_string());
    }
    if unsafe { SetForegroundWindow(target) } == 0 {
        return Err("Unable to restore the dictation target window.".to_string());
    }
    std::thread::sleep(std::time::Duration::from_millis(35));

    for _ in 0..replace_characters.unwrap_or(0) {
        let mut inputs = [
            INPUT {
                r#type: INPUT_KEYBOARD,
                Anonymous: INPUT_0 {
                    ki: KEYBDINPUT {
                        wVk: VK_BACK,
                        wScan: 0,
                        dwFlags: 0,
                        time: 0,
                        dwExtraInfo: 0,
                    },
                },
            },
            INPUT {
                r#type: INPUT_KEYBOARD,
                Anonymous: INPUT_0 {
                    ki: KEYBDINPUT {
                        wVk: VK_BACK,
                        wScan: 0,
                        dwFlags: KEYEVENTF_KEYUP,
                        time: 0,
                        dwExtraInfo: 0,
                    },
                },
            },
        ];
        let sent = unsafe {
            SendInput(
                inputs.len() as u32,
                inputs.as_mut_ptr(),
                size_of::<INPUT>() as i32,
            )
        };
        if sent != inputs.len() as u32 {
            return Err("Windows rejected global dictation correction.".to_string());
        }
    }

    for unit in text.encode_utf16() {
        let mut inputs = [
            INPUT {
                r#type: INPUT_KEYBOARD,
                Anonymous: INPUT_0 {
                    ki: KEYBDINPUT {
                        wVk: 0,
                        wScan: unit,
                        dwFlags: KEYEVENTF_UNICODE,
                        time: 0,
                        dwExtraInfo: 0,
                    },
                },
            },
            INPUT {
                r#type: INPUT_KEYBOARD,
                Anonymous: INPUT_0 {
                    ki: KEYBDINPUT {
                        wVk: 0,
                        wScan: unit,
                        dwFlags: KEYEVENTF_UNICODE | KEYEVENTF_KEYUP,
                        time: 0,
                        dwExtraInfo: 0,
                    },
                },
            },
        ];
        let sent = unsafe {
            SendInput(
                inputs.len() as u32,
                inputs.as_mut_ptr(),
                size_of::<INPUT>() as i32,
            )
        };
        if sent != inputs.len() as u32 {
            return Err("Windows rejected global dictation input.".to_string());
        }
    }
    Ok(())
}

#[cfg(not(target_os = "windows"))]
#[tauri::command]
pub fn cmd_insert_global_dictation_text(
    _text: String,
    _replace_characters: Option<u32>,
    _finalize: Option<bool>,
) -> Result<(), String> {
    Err("Global dictation is currently available on Windows only.".to_string())
}

fn config_path() -> Option<PathBuf> {
    crate::app_dirs::blexagent_data_dir().map(|d| d.join("config.json"))
}

/// Read GlobalSummonConfig from config.json. Missing or malformed → defaults.
pub fn load_config() -> GlobalSummonConfig {
    let Some(path) = config_path() else {
        return GlobalSummonConfig::default();
    };
    let Ok(content) = std::fs::read_to_string(&path) else {
        return GlobalSummonConfig::default();
    };
    let Ok(cfg) = serde_json::from_str::<serde_json::Value>(crate::utils::bom::strip_bom(&content))
    else {
        return GlobalSummonConfig::default();
    };
    cfg.get("globalSummonShortcut")
        .and_then(|v| serde_json::from_value::<GlobalSummonConfig>(v.clone()).ok())
        .unwrap_or_default()
}

pub fn load_voice_config() -> GlobalVoiceConfig {
    let Some(path) = config_path() else {
        return GlobalVoiceConfig::default();
    };
    let Ok(content) = std::fs::read_to_string(&path) else {
        return GlobalVoiceConfig::default();
    };
    let Ok(cfg) = serde_json::from_str::<serde_json::Value>(crate::utils::bom::strip_bom(&content))
    else {
        return GlobalVoiceConfig::default();
    };
    cfg.get("globalVoiceShortcut")
        .and_then(|v| serde_json::from_value::<GlobalVoiceConfig>(v.clone()).ok())
        .unwrap_or_default()
}

/// Persist GlobalSummonConfig back to config.json under the standard config lock.
fn save_config(cfg: &GlobalSummonConfig) -> Result<(), String> {
    let path = config_path().ok_or_else(|| "[global-shortcut] no data dir".to_string())?;
    let cfg = cfg.clone();
    crate::config_io::with_config_lock(&path, false, move |json| {
        if !json.is_object() {
            *json = serde_json::json!({});
        }
        let value = serde_json::to_value(&cfg)
            .map_err(|e| format!("[global-shortcut] serialize: {}", e))?;
        json.as_object_mut()
            .ok_or_else(|| "[global-shortcut] config root not an object".to_string())?
            .insert("globalSummonShortcut".to_string(), value);
        Ok(())
    })
    .map(|_| ())
}

/// Parse a Tauri accelerator string ("CmdOrCtrl+Shift+M") into a `Shortcut`.
///
/// Tauri's `Shortcut::from_str` is platform-agnostic-ish but the version we
/// ship doesn't accept all the spellings users might type. We normalize a few
/// common aliases up-front, then defer to the plugin's parser.
fn parse_accelerator(input: &str) -> Result<Shortcut, String> {
    let normalized = input.trim();
    if normalized.is_empty() {
        return Err("[global-shortcut] empty accelerator".to_string());
    }

    let mut modifiers = Modifiers::empty();
    let mut key_code: Option<Code> = None;

    for part in normalized.split('+').map(str::trim) {
        if part.is_empty() {
            return Err(format!(
                "[global-shortcut] malformed accelerator: '{}'",
                normalized
            ));
        }
        let lower = part.to_ascii_lowercase();
        match lower.as_str() {
            "cmdorctrl" | "commandorcontrol" => {
                #[cfg(target_os = "macos")]
                modifiers.insert(Modifiers::SUPER);
                #[cfg(not(target_os = "macos"))]
                modifiers.insert(Modifiers::CONTROL);
            }
            "cmd" | "command" | "super" | "meta" | "win" => modifiers.insert(Modifiers::SUPER),
            "ctrl" | "control" => modifiers.insert(Modifiers::CONTROL),
            "alt" | "option" | "opt" => modifiers.insert(Modifiers::ALT),
            "shift" => modifiers.insert(Modifiers::SHIFT),
            _ => {
                if key_code.is_some() {
                    return Err(format!(
                        "[global-shortcut] multiple main keys in '{}'",
                        normalized
                    ));
                }
                key_code = Some(parse_code(&lower)?);
            }
        }
    }

    let code = key_code
        .ok_or_else(|| format!("[global-shortcut] missing main key in '{}'", normalized))?;

    Ok(Shortcut::new(Some(modifiers), code))
}

fn parse_code(s: &str) -> Result<Code, String> {
    // letters
    if s.len() == 1 {
        let c = s.chars().next().unwrap();
        if c.is_ascii_alphabetic() {
            let upper = c.to_ascii_uppercase();
            return match upper {
                'A' => Ok(Code::KeyA),
                'B' => Ok(Code::KeyB),
                'C' => Ok(Code::KeyC),
                'D' => Ok(Code::KeyD),
                'E' => Ok(Code::KeyE),
                'F' => Ok(Code::KeyF),
                'G' => Ok(Code::KeyG),
                'H' => Ok(Code::KeyH),
                'I' => Ok(Code::KeyI),
                'J' => Ok(Code::KeyJ),
                'K' => Ok(Code::KeyK),
                'L' => Ok(Code::KeyL),
                'M' => Ok(Code::KeyM),
                'N' => Ok(Code::KeyN),
                'O' => Ok(Code::KeyO),
                'P' => Ok(Code::KeyP),
                'Q' => Ok(Code::KeyQ),
                'R' => Ok(Code::KeyR),
                'S' => Ok(Code::KeyS),
                'T' => Ok(Code::KeyT),
                'U' => Ok(Code::KeyU),
                'V' => Ok(Code::KeyV),
                'W' => Ok(Code::KeyW),
                'X' => Ok(Code::KeyX),
                'Y' => Ok(Code::KeyY),
                'Z' => Ok(Code::KeyZ),
                _ => Err(format!("[global-shortcut] unsupported key '{}'", s)),
            };
        }
        if c.is_ascii_digit() {
            return match c {
                '0' => Ok(Code::Digit0),
                '1' => Ok(Code::Digit1),
                '2' => Ok(Code::Digit2),
                '3' => Ok(Code::Digit3),
                '4' => Ok(Code::Digit4),
                '5' => Ok(Code::Digit5),
                '6' => Ok(Code::Digit6),
                '7' => Ok(Code::Digit7),
                '8' => Ok(Code::Digit8),
                '9' => Ok(Code::Digit9),
                _ => unreachable!(),
            };
        }
    }
    match s {
        "space" => Ok(Code::Space),
        "enter" | "return" => Ok(Code::Enter),
        "tab" => Ok(Code::Tab),
        "esc" | "escape" => Ok(Code::Escape),
        "backspace" => Ok(Code::Backspace),
        "delete" | "del" => Ok(Code::Delete),
        "left" | "arrowleft" => Ok(Code::ArrowLeft),
        "right" | "arrowright" => Ok(Code::ArrowRight),
        "up" | "arrowup" => Ok(Code::ArrowUp),
        "down" | "arrowdown" => Ok(Code::ArrowDown),
        "comma" => Ok(Code::Comma),
        "period" | "." => Ok(Code::Period),
        "slash" | "/" => Ok(Code::Slash),
        "backslash" | "\\" => Ok(Code::Backslash),
        "semicolon" | ";" => Ok(Code::Semicolon),
        "quote" | "'" => Ok(Code::Quote),
        "bracketleft" | "[" => Ok(Code::BracketLeft),
        "bracketright" | "]" => Ok(Code::BracketRight),
        "minus" | "-" => Ok(Code::Minus),
        "equal" | "=" => Ok(Code::Equal),
        "f1" => Ok(Code::F1),
        "f2" => Ok(Code::F2),
        "f3" => Ok(Code::F3),
        "f4" => Ok(Code::F4),
        "f5" => Ok(Code::F5),
        "f6" => Ok(Code::F6),
        "f7" => Ok(Code::F7),
        "f8" => Ok(Code::F8),
        "f9" => Ok(Code::F9),
        "f10" => Ok(Code::F10),
        "f11" => Ok(Code::F11),
        "f12" => Ok(Code::F12),
        "altright" | "rightalt" | "altgr" => Ok(Code::AltRight),
        _ => Err(format!("[global-shortcut] unsupported key '{}'", s)),
    }
}

/// Handler fired on shortcut Pressed event — toggle or summon.
fn on_summon_pressed<R: Runtime>(app: &AppHandle<R>) {
    let Some(window) = app.get_webview_window("main") else {
        ulog_warn!("[global-shortcut] no main window, ignoring");
        return;
    };

    // Determine current state; failures are non-fatal (default to summon).
    let visible = window.is_visible().unwrap_or(false);
    let focused = window.is_focused().unwrap_or(false);

    if visible && focused {
        ulog_info!("[global-shortcut] hide (already visible+focused)");
        if let Err(e) = window.hide() {
            ulog_error!("[global-shortcut] hide failed: {}", e);
        }
        return;
    }

    ulog_info!(
        "[global-shortcut] summon (visible={}, focused={})",
        visible,
        focused
    );
    crate::tray::show_main_window(app);
}

fn emit_voice_capsule_recording_state<R: Runtime>(app: &AppHandle<R>, kind: &'static str) {
    let _ = app.emit(
        "voice-capsule-state",
        serde_json::json!({
            "kind": kind,
            "phase": "recording",
            "transcript": "",
            "response": "",
            "audioLevels": []
        }),
    );
}

fn ensure_voice_capsule<R: Runtime>(
    app: &AppHandle<R>,
    initial_kind: &'static str,
) -> Result<(), String> {
    let window = if let Some(window) = app.get_webview_window("voice-capsule") {
        window
    } else {
        let url = WebviewUrl::App(format!("index.html?voiceCapsuleKind={initial_kind}").into());
        WebviewWindowBuilder::new(app, "voice-capsule", url)
            .title("BlexAgent Voice")
            .inner_size(400.0, 190.0)
            .resizable(false)
            .decorations(false)
            .transparent(true)
            .shadow(false)
            .always_on_top(true)
            .visible(false)
            .skip_taskbar(true)
            .accept_first_mouse(true)
            .build()
            .map_err(|error| format!("[global-shortcut] create voice capsule: {error}"))?
    };
    if let Ok(Some(monitor)) = app.primary_monitor() {
        let scale = monitor.scale_factor();
        let size = monitor.size().to_logical::<f64>(scale);
        let origin = monitor.position().to_logical::<f64>(scale);
        let _ = window.set_position(LogicalPosition::new(
            origin.x + (size.width - 400.0) / 2.0,
            origin.y + size.height - 230.0,
        ));
    }
    window
        .show()
        .map_err(|error| format!("[global-shortcut] show voice capsule: {error}"))
}

#[tauri::command]
pub fn cmd_hide_voice_capsule(app: AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("voice-capsule") {
        window
            .hide()
            .map_err(|error| format!("[global-shortcut] hide voice capsule: {error}"))?;
    }
    Ok(())
}

#[tauri::command]
pub fn cmd_open_main_from_voice_capsule(app: AppHandle) -> Result<(), String> {
    crate::tray::show_main_window(&app);
    cmd_hide_voice_capsule(app)
}

fn on_voice_pressed<R: Runtime>(app: &AppHandle<R>) {
    let surface = app
        .get_webview_window("main")
        .map(|window| {
            let visible = window.is_visible().unwrap_or(false);
            let minimized = window.is_minimized().unwrap_or(false);
            let focused = window.is_focused().unwrap_or(false);
            if !visible || minimized {
                ulog_info!(
                    "[global-shortcut] voice wake using capsule (visible={}, minimized={})",
                    visible,
                    minimized
                );
                return "capsule";
            }
            if !focused {
                ulog_info!(
                    "[global-shortcut] voice wake raising main window (visible={}, minimized={}, focused={})",
                    visible,
                    minimized,
                    focused
                );
                crate::tray::show_main_window(app);
            }
            "chat"
        })
        .unwrap_or("capsule");
    if surface == "capsule" {
        emit_voice_capsule_recording_state(app, "ai");
        if let Err(error) = ensure_voice_capsule(app, "ai") {
            ulog_error!("{}", error);
        }
    }
    let revision = if let Ok(mut current) = CURRENT_VOICE_STATE.lock() {
        current.surface = Some(surface);
        current.held = true;
        current.revision = current.revision.wrapping_add(1);
        current.revision
    } else {
        ulog_error!("[global-shortcut] voice runtime state mutex poisoned on press");
        0
    };
    let _ = app.emit(
        "global-voice-wake-start",
        serde_json::json!({ "surface": surface, "revision": revision }),
    );
    ulog_info!(
        "[global-shortcut] voice wake surface={} revision={}",
        surface,
        revision
    );
}

fn on_voice_released<R: Runtime>(app: &AppHandle<R>) {
    let (surface, revision) = if let Ok(mut current) = CURRENT_VOICE_STATE.lock() {
        let surface = current.surface.take();
        if current.held {
            current.held = false;
            current.revision = current.revision.wrapping_add(1);
        }
        (surface, current.revision)
    } else {
        ulog_error!("[global-shortcut] voice runtime state mutex poisoned on release");
        (None, 0)
    };
    let _ = app.emit(
        "global-voice-wake-stop",
        serde_json::json!({ "surface": surface, "revision": revision }),
    );
    ulog_info!(
        "[global-shortcut] voice wake released surface={:?} revision={}",
        surface,
        revision
    );
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GlobalVoiceWakeSnapshot {
    held: bool,
    surface: Option<String>,
    revision: u64,
}

/// Durable native-key state for a WebView that was created after the initial
/// DOWN event. Event delivery is transient; this snapshot closes the first
/// capsule mount and hidden-renderer race without polling the physical mouse.
#[tauri::command]
pub fn cmd_get_global_voice_wake_snapshot() -> GlobalVoiceWakeSnapshot {
    CURRENT_VOICE_STATE
        .lock()
        .map(|state| GlobalVoiceWakeSnapshot {
            held: state.held,
            surface: state.surface.map(str::to_owned),
            revision: state.revision,
        })
        .unwrap_or(GlobalVoiceWakeSnapshot {
            held: false,
            surface: None,
            revision: 0,
        })
}

#[cfg(target_os = "windows")]
enum NativeVoiceInput {
    VirtualKey(i32, &'static str),
    LingjiAi,
}

#[cfg(target_os = "windows")]
fn native_voice_button(accelerator: &str) -> Option<NativeVoiceInput> {
    match accelerator.trim().to_ascii_lowercase().as_str() {
        "lingjiai" | "lingji-ai" => Some(NativeVoiceInput::LingjiAi),
        "altright" | "rightalt" | "altgr" => {
            Some(NativeVoiceInput::VirtualKey(0xA5, "physical Right Alt"))
        }
        "mousex1" | "xbutton1" | "mouseback" => {
            Some(NativeVoiceInput::VirtualKey(0x05, "mouse side button 1"))
        }
        "mousex2" | "xbutton2" | "mouseforward" => {
            Some(NativeVoiceInput::VirtualKey(0x06, "mouse side button 2"))
        }
        _ => None,
    }
}

#[cfg(not(target_os = "windows"))]
fn native_voice_button(_accelerator: &str) -> Option<()> {
    None
}

#[cfg(target_os = "windows")]
fn start_native_voice_monitor<R: Runtime>(
    app: &AppHandle<R>,
    virtual_key: i32,
    label: &'static str,
) {
    use std::time::Duration;
    use windows_sys::Win32::UI::Input::KeyboardAndMouse::GetAsyncKeyState;

    let generation = VOICE_POLL_GENERATION.fetch_add(1, Ordering::Relaxed) + 1;
    let app = app.clone();
    tauri::async_runtime::spawn(async move {
        let mut was_down = unsafe { GetAsyncKeyState(virtual_key) } < 0;
        loop {
            tokio::time::sleep(Duration::from_millis(12)).await;
            if VOICE_POLL_GENERATION.load(Ordering::Relaxed) != generation {
                if was_down {
                    let app_for_release = app.clone();
                    let _ = app.run_on_main_thread(move || on_voice_released(&app_for_release));
                }
                break;
            }
            let is_down = unsafe { GetAsyncKeyState(virtual_key) } < 0;
            if is_down == was_down {
                continue;
            }
            was_down = is_down;
            let app_for_event = app.clone();
            let _ = app.run_on_main_thread(move || {
                if is_down {
                    on_voice_pressed(&app_for_event);
                } else {
                    on_voice_released(&app_for_event);
                }
            });
        }
    });
    ulog_info!("[global-shortcut] monitoring {} for voice wake", label);
}

#[cfg(target_os = "windows")]
fn lingji_ai_edge(report: &[u8]) -> Option<bool> {
    match lingji_control_code(report)? {
        0x23 => Some(true),
        0x24 => Some(false),
        _ => None,
    }
}

#[cfg(target_os = "windows")]
fn lingji_control_code(report: &[u8]) -> Option<u8> {
    if report.len() < 6
        || report[0] != 0x0A
        || report[1] != 0xD0
        || report[2] != 0x99
        || report[4] != 0x01
    {
        return None;
    }
    // report[3] is the current battery percentage, not a protocol/version
    // marker. It changes during normal use and must never gate button routing.
    Some(report[5])
}

#[cfg(target_os = "windows")]
fn lingji_output_report(command: u8) -> [u8; 10] {
    let mut report = [0_u8; 10];
    report[0] = 0x0A;
    report[1] = 0x03;
    report[2] = command;
    report
}

#[cfg(target_os = "windows")]
const LINGJI_INIT_STEPS: &[(u8, u64)] = &[(0xA0, 3), (0x41, 1_300), (0x26, 6), (0x52, 0)];
#[cfg(target_os = "windows")]
const LINGJI_STATUS_POLL_INTERVAL: std::time::Duration = std::time::Duration::from_secs(1);
#[cfg(target_os = "windows")]
const LINGJI_PROTOCOL_SILENCE_TIMEOUT: std::time::Duration = std::time::Duration::from_secs(5);
#[cfg(target_os = "windows")]
const LINGJI_HEALTH_LOG_INTERVAL: std::time::Duration = std::time::Duration::from_secs(60);
#[cfg(target_os = "windows")]
const LINGJI_MAX_HELD_DURATION: std::time::Duration = std::time::Duration::from_secs(90);
#[cfg(target_os = "windows")]
const LINGJI_LOOP_GAP_RECOVERY: std::time::Duration = std::time::Duration::from_secs(3);

#[cfg(target_os = "windows")]
fn send_lingji_command(device: &hidapi::HidDevice, command: u8) -> Result<(), String> {
    let report = lingji_output_report(command);
    // SonicUMouse.exe calls hid_write with these ten user-space bytes. The
    // windows-native hidapi backend pads them to OutputReportByteLength and
    // sends them through WriteFile. Although USBPcap ultimately displays an
    // HID SET_REPORT transaction, HidD_SetOutputReport is a different Windows
    // API path and leaves this receiver silent.
    device
        .write(&report)
        .map(|_| ())
        .map_err(|error| format!("hid_write command 0x{command:02X}: {error}"))
}

#[cfg(target_os = "windows")]
fn initialize_lingji_ai(device: &hidapi::HidDevice) -> Result<(), String> {
    // Two independent uMouse startup captures agree on this command order.
    // Delays are conservative upper bounds derived from both captures.
    for &(command, delay_after_ms) in LINGJI_INIT_STEPS {
        send_lingji_command(device, command)?;
        if delay_after_ms > 0 {
            std::thread::sleep(std::time::Duration::from_millis(delay_after_ms));
        }
    }
    Ok(())
}

#[cfg(target_os = "windows")]
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum LingjiButtonState {
    Up,
    Down,
}

#[cfg(target_os = "windows")]
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum LingjiEdgeTransition {
    Ignore,
    Press,
    Release,
    RetryPress,
}

#[cfg(target_os = "windows")]
fn lingji_edge_transition(state: LingjiButtonState, is_down: bool) -> LingjiEdgeTransition {
    match (state, is_down) {
        (LingjiButtonState::Up, true) => LingjiEdgeTransition::Press,
        (LingjiButtonState::Down, false) => LingjiEdgeTransition::Release,
        // The receiver emits edge reports, not key-repeat reports. A second
        // DOWN therefore means the previous UP was lost (or its dispatch was
        // missed). Re-deliver start idempotently and let the next UP close the
        // active capture instead of ignoring every future press indefinitely.
        (LingjiButtonState::Down, true) => LingjiEdgeTransition::RetryPress,
        (LingjiButtonState::Up, false) => LingjiEdgeTransition::Ignore,
    }
}

#[cfg(target_os = "windows")]
fn start_lingji_ai_monitor<R: Runtime>(app: &AppHandle<R>) {
    use std::time::{Duration, Instant};

    const VID: u16 = 0xABC9;
    const PID: u16 = 0xCA89;
    const VENDOR_USAGE_PAGE: u16 = 0xFF03;

    let generation = VOICE_POLL_GENERATION.fetch_add(1, Ordering::Relaxed) + 1;
    let app = app.clone();
    tauri::async_runtime::spawn_blocking(move || {
        let mut recovery_count = 0_u64;
        let mut consecutive_failures = 0_u32;
        while VOICE_POLL_GENERATION.load(Ordering::Relaxed) == generation {
            let api = match hidapi::HidApi::new() {
                Ok(api) => api,
                Err(error) => {
                    ulog_warn!("[global-shortcut] initialize Lingji HID failed: {}", error);
                    std::thread::sleep(Duration::from_secs(1));
                    continue;
                }
            };
            // The receiver exposes several HID collections with the same VID/PID.
            // Windows does not guarantee their enumeration order, so an `A || B`
            // predicate combined with `find()` can open a non-vendor collection
            // after a reboot/replug. Always prefer the FF03 vendor collection and
            // only retain the historical MI_01 fallback for older firmware.
            let info = api
                .device_list()
                .find(|info| {
                    info.vendor_id() == VID
                        && info.product_id() == PID
                        && info.usage_page() == VENDOR_USAGE_PAGE
                })
                .or_else(|| {
                    api.device_list().find(|info| {
                        info.vendor_id() == VID
                            && info.product_id() == PID
                            && info
                                .path()
                                .to_string_lossy()
                                .to_ascii_lowercase()
                                .contains("mi_01")
                    })
                });
            let Some(info) = info else {
                if consecutive_failures == 0 {
                    ulog_warn!(
                        "[global-shortcut] Lingji HID is not present; waiting for VID={:04X} PID={:04X}",
                        VID,
                        PID
                    );
                }
                consecutive_failures = consecutive_failures.saturating_add(1);
                std::thread::sleep(Duration::from_secs(1));
                continue;
            };
            ulog_info!(
                "[global-shortcut] opening Lingji HID usage=0x{:04X}/0x{:04X} interface={} path={}",
                info.usage_page(),
                info.usage(),
                info.interface_number(),
                info.path().to_string_lossy()
            );
            let device = match info.open_device(&api) {
                Ok(device) => device,
                Err(error) => {
                    ulog_warn!(
                        "[global-shortcut] open Lingji AI interface failed: {}",
                        error
                    );
                    std::thread::sleep(Duration::from_secs(1));
                    continue;
                }
            };
            if let Err(error) = initialize_lingji_ai(&device) {
                consecutive_failures = consecutive_failures.saturating_add(1);
                recovery_count = recovery_count.saturating_add(1);
                ulog_warn!(
                    "[global-shortcut] initialize Lingji AI protocol failed: {}; recovery={} retryMs=1000",
                    error,
                    recovery_count
                );
                drop(device);
                std::thread::sleep(Duration::from_secs(1));
                continue;
            }
            ulog_info!(
                "[global-shortcut] initialized Lingji AI protocol commands=A0,41,26,52 transport=hid_write"
            );
            ulog_info!(
                "[global-shortcut] monitoring Lingji AI HID button generation={} (awaiting device heartbeat)",
                generation
            );
            let mut report = [0_u8; 64];
            let mut logged_unclassified = [false; 256];
            let mut ai_state = LingjiButtonState::Up;
            let mut dictation_state = LingjiButtonState::Up;
            let mut ai_down_since: Option<Instant> = None;
            let mut dictation_down_since: Option<Instant> = None;
            let opened_at = Instant::now();
            let mut next_status_poll_at = opened_at + LINGJI_STATUS_POLL_INTERVAL;
            let mut last_protocol_at: Option<Instant> = None;
            let mut last_heartbeat_at: Option<Instant> = None;
            let mut last_health_log_at = Instant::now();
            let mut last_loop_at = Instant::now();
            let mut recovery_deferred_while_down = false;
            let mut saw_healthy_protocol = false;
            let mut recovery_reason: Option<String> = None;
            loop {
                if VOICE_POLL_GENERATION.load(Ordering::Relaxed) != generation {
                    break;
                }

                let now = Instant::now();
                let loop_gap = now.saturating_duration_since(last_loop_at);
                last_loop_at = now;
                if loop_gap >= LINGJI_LOOP_GAP_RECOVERY {
                    recovery_reason = Some(format!(
                        "monitor loop paused for {}ms (sleep/resume or blocked HID I/O)",
                        loop_gap.as_millis()
                    ));
                    break;
                }
                if ai_state == LingjiButtonState::Down
                    && ai_down_since
                        .map(|started| started.elapsed() >= LINGJI_MAX_HELD_DURATION)
                        .unwrap_or(false)
                {
                    ulog_warn!(
                        "[global-shortcut] Lingji AI release was not observed for {}s; synthesizing release",
                        LINGJI_MAX_HELD_DURATION.as_secs()
                    );
                    ai_state = LingjiButtonState::Up;
                    ai_down_since = None;
                    let app_for_event = app.clone();
                    if let Err(error) =
                        app.run_on_main_thread(move || on_voice_released(&app_for_event))
                    {
                        ulog_error!(
                            "[global-shortcut] dispatch synthesized AI release failed: {}",
                            error
                        );
                    }
                }
                if dictation_state == LingjiButtonState::Down
                    && dictation_down_since
                        .map(|started| started.elapsed() >= LINGJI_MAX_HELD_DURATION)
                        .unwrap_or(false)
                {
                    ulog_warn!(
                        "[global-shortcut] Lingji dictation release was not observed for {}s; synthesizing release",
                        LINGJI_MAX_HELD_DURATION.as_secs()
                    );
                    dictation_state = LingjiButtonState::Up;
                    dictation_down_since = None;
                    let app_for_event = app.clone();
                    if let Err(error) =
                        app.run_on_main_thread(move || on_dictation_released(&app_for_event))
                    {
                        ulog_error!(
                            "[global-shortcut] dispatch synthesized dictation release failed: {}",
                            error
                        );
                    }
                }

                // uMouse emits two phase-shifted A0 flows, totalling roughly
                // two requests per second. One request per second is sufficient
                // for Blex's single owner loop and keeps vendor reporting alive
                // without duplicating the driver's two internal timers.
                if now >= next_status_poll_at {
                    if let Err(error) = send_lingji_command(&device, 0xA0) {
                        ulog_warn!(
                            "[global-shortcut] Lingji periodic status query failed; supervisor will verify protocol health: {}",
                            error
                        );
                    }
                    next_status_poll_at = now + LINGJI_STATUS_POLL_INTERVAL;
                }

                // 0x55 is device-initiated and appears about once per second in
                // both independent USB captures, including before the first A0
                // query. If all valid protocol frames stop, the Windows HID
                // read handle is stale even though PnP and writes can still
                // look healthy. Drop only this handle, reopen it, and rerun the
                // required initialization sequence before accepting input.
                let protocol_silence = last_protocol_at
                    .map(|instant| instant.elapsed())
                    .unwrap_or_else(|| opened_at.elapsed());
                if protocol_silence >= LINGJI_PROTOCOL_SILENCE_TIMEOUT {
                    if ai_state == LingjiButtonState::Down
                        || dictation_state == LingjiButtonState::Down
                    {
                        if !recovery_deferred_while_down {
                            ulog_warn!(
                                "[global-shortcut] Lingji protocol silent for {}ms while a voice key is down; deferring handle recovery until release",
                                protocol_silence.as_millis()
                            );
                            recovery_deferred_while_down = true;
                        }
                    } else {
                        recovery_reason = Some(format!(
                            "no device protocol frame for {}ms",
                            protocol_silence.as_millis()
                        ));
                        break;
                    }
                }

                if last_health_log_at.elapsed() >= LINGJI_HEALTH_LOG_INTERVAL {
                    let protocol_age_ms = last_protocol_at
                        .map(|instant| instant.elapsed().as_millis().to_string())
                        .unwrap_or_else(|| "never".to_string());
                    let heartbeat_age_ms = last_heartbeat_at
                        .map(|instant| instant.elapsed().as_millis().to_string())
                        .unwrap_or_else(|| "never".to_string());
                    ulog_info!(
                        "[global-shortcut] Lingji health state={} protocolAgeMs={} heartbeatAgeMs={} recoveries={}",
                        if saw_healthy_protocol { "healthy" } else { "awaiting-heartbeat" },
                        protocol_age_ms,
                        heartbeat_age_ms,
                        recovery_count
                    );
                    last_health_log_at = Instant::now();
                }

                match device.read_timeout(&mut report, 100) {
                    // A short timeout is expected between the one-second
                    // device-initiated status frames. Health is decided by
                    // observed protocol traffic, never by mouse motion or by
                    // assuming an output command was acknowledged.
                    Ok(0) => {}
                    Ok(length) => {
                        let control_code = lingji_control_code(&report[..length]);
                        if let Some(code) = control_code {
                            let now = Instant::now();
                            last_protocol_at = Some(now);
                            if code == 0x55 {
                                last_heartbeat_at = Some(now);
                            }
                            recovery_deferred_while_down = false;
                            if !saw_healthy_protocol {
                                saw_healthy_protocol = true;
                                consecutive_failures = 0;
                                ulog_info!(
                                    "[global-shortcut] Lingji HID healthy; first protocol code=0x{:02X}",
                                    code
                                );
                            }
                            match code {
                                0x21 => {
                                    if dictation_state == LingjiButtonState::Up {
                                        dictation_state = LingjiButtonState::Down;
                                        dictation_down_since = Some(now);
                                        ulog_info!(
                                            "[global-shortcut] Lingji raw dictation DOWN code=0x21"
                                        );
                                        let app_for_event = app.clone();
                                        if let Err(error) = app.run_on_main_thread(move || {
                                            on_dictation_pressed(&app_for_event)
                                        }) {
                                            ulog_error!(
                                                "[global-shortcut] dispatch dictation DOWN failed: {}",
                                                error
                                            );
                                        }
                                    }
                                }
                                0x22 => {
                                    if dictation_state == LingjiButtonState::Down {
                                        dictation_state = LingjiButtonState::Up;
                                        dictation_down_since = None;
                                        ulog_info!(
                                            "[global-shortcut] Lingji raw dictation UP code=0x22"
                                        );
                                        let app_for_event = app.clone();
                                        if let Err(error) = app.run_on_main_thread(move || {
                                            on_dictation_released(&app_for_event)
                                        }) {
                                            ulog_error!(
                                                "[global-shortcut] dispatch dictation UP failed: {}",
                                                error
                                            );
                                        }
                                    }
                                }
                                _ => {}
                            }
                            // 0x55 is the periodic idle/status packet. Log all
                            // other unclassified controls so additional physical
                            // buttons can be mapped without uMouse or guesswork.
                            if !matches!(code, 0x21 | 0x22 | 0x23 | 0x24 | 0x55)
                                && !logged_unclassified[usize::from(code)]
                            {
                                ulog_info!(
                                    "[global-shortcut] Lingji unclassified control code=0x{:02X} report={:02X?}",
                                    code,
                                    &report[..length.min(16)]
                                );
                                logged_unclassified[usize::from(code)] = true;
                            }
                        }
                        let Some(is_down) = lingji_ai_edge(&report[..length]) else {
                            continue;
                        };
                        let transition = lingji_edge_transition(ai_state, is_down);
                        match transition {
                            LingjiEdgeTransition::Ignore => continue,
                            LingjiEdgeTransition::Press | LingjiEdgeTransition::RetryPress => {
                                if transition == LingjiEdgeTransition::RetryPress {
                                    ulog_warn!(
                                        "[global-shortcut] Lingji AI DOWN arrived while state was DOWN; retrying start after a lost release/dispatch"
                                    );
                                }
                                ai_state = LingjiButtonState::Down;
                                ai_down_since = Some(Instant::now());
                            }
                            LingjiEdgeTransition::Release => {
                                ai_state = LingjiButtonState::Up;
                                ai_down_since = None;
                            }
                        }
                        ulog_info!(
                            "[global-shortcut] Lingji raw AI {} code=0x{:02X} transition={:?}",
                            if is_down { "DOWN" } else { "UP" },
                            if is_down { 0x23 } else { 0x24 },
                            transition
                        );
                        let app_for_event = app.clone();
                        if let Err(error) = app.run_on_main_thread(move || {
                            match transition {
                                LingjiEdgeTransition::RetryPress => {
                                    // A second edge-only DOWN means the prior
                                    // UP vanished. Close the stale capture and
                                    // immediately establish a new native turn.
                                    on_voice_released(&app_for_event);
                                    on_voice_pressed(&app_for_event);
                                }
                                LingjiEdgeTransition::Press => on_voice_pressed(&app_for_event),
                                LingjiEdgeTransition::Release => on_voice_released(&app_for_event),
                                LingjiEdgeTransition::Ignore => {}
                            }
                        }) {
                            ulog_error!(
                                "[global-shortcut] dispatch AI {} failed: {}",
                                if is_down { "DOWN" } else { "UP" },
                                error
                            );
                        }
                    }
                    Err(error) => {
                        recovery_reason = Some(format!("HID read interrupted: {error}"));
                        break;
                    }
                }
            }
            if ai_state == LingjiButtonState::Down {
                let app_for_release = app.clone();
                let _ = app.run_on_main_thread(move || on_voice_released(&app_for_release));
            }
            if dictation_state == LingjiButtonState::Down {
                let app_for_release = app.clone();
                let _ = app.run_on_main_thread(move || on_dictation_released(&app_for_release));
            }
            if VOICE_POLL_GENERATION.load(Ordering::Relaxed) != generation {
                break;
            }
            recovery_count = recovery_count.saturating_add(1);
            if saw_healthy_protocol {
                consecutive_failures = 0;
            } else {
                consecutive_failures = consecutive_failures.saturating_add(1);
            }
            let backoff_ms = if saw_healthy_protocol {
                // A formerly healthy handle went stale: reopen almost
                // immediately so a wake key is not lost during a long idle.
                100
            } else {
                // Bound initial/device-contention retry latency to one second.
                let backoff_step = consecutive_failures.min(2);
                250_u64.saturating_mul(1_u64 << backoff_step)
            };
            ulog_warn!(
                "[global-shortcut] Lingji supervisor recovering reason='{}' recovery={} backoffMs={}",
                recovery_reason.unwrap_or_else(|| "monitor generation changed".to_string()),
                recovery_count,
                backoff_ms
            );
            // Dropping the device cancels hidapi's pending overlapped ReadFile.
            // Re-enumeration is the only reliable recovery from a handle that
            // remains PnP-healthy but has stopped completing input reports.
            drop(device);
            std::thread::sleep(Duration::from_millis(backoff_ms));
        }
    });
}

fn register_voice<R: Runtime>(app: &AppHandle<R>, accelerator: &str) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    if let Some(native) = native_voice_button(accelerator) {
        match native {
            NativeVoiceInput::VirtualKey(virtual_key, label) => {
                start_native_voice_monitor(app, virtual_key, label)
            }
            NativeVoiceInput::LingjiAi => start_lingji_ai_monitor(app),
        }
        if let Ok(mut guard) = CURRENT_VOICE_ACCELERATOR.lock() {
            *guard = Some(accelerator.to_string());
        }
        return Ok(());
    }

    let shortcut = parse_accelerator(accelerator)?;
    app.global_shortcut()
        .register(shortcut)
        .map_err(|e| format!("注册语音快捷键失败: {}", e))?;
    if let Ok(mut guard) = CURRENT_VOICE_ACCELERATOR.lock() {
        *guard = Some(accelerator.to_string());
    }
    Ok(())
}

fn unregister_voice<R: Runtime>(app: &AppHandle<R>) -> Result<(), String> {
    let previous = CURRENT_VOICE_ACCELERATOR
        .lock()
        .ok()
        .and_then(|guard| guard.clone());
    if let Some(previous) = previous {
        #[cfg(target_os = "windows")]
        if native_voice_button(&previous).is_some() {
            VOICE_POLL_GENERATION.fetch_add(1, Ordering::Relaxed);
            on_voice_released(app);
        } else if let Ok(shortcut) = parse_accelerator(&previous) {
            app.global_shortcut()
                .unregister(shortcut)
                .map_err(|e| format!("注销语音快捷键失败: {}", e))?;
        }
        #[cfg(not(target_os = "windows"))]
        if let Ok(shortcut) = parse_accelerator(&previous) {
            app.global_shortcut()
                .unregister(shortcut)
                .map_err(|e| format!("注销语音快捷键失败: {}", e))?;
        }
    }
    if let Ok(mut guard) = CURRENT_VOICE_ACCELERATOR.lock() {
        *guard = None;
    }
    Ok(())
}

/// Register `accelerator` and remember it for later unregister.
///
/// Returns Err with a user-friendly message if the OS refuses (already taken,
/// platform doesn't support the combo, etc.).
pub fn register<R: Runtime>(app: &AppHandle<R>, accelerator: &str) -> Result<(), String> {
    let shortcut = parse_accelerator(accelerator)?;
    let gs = app.global_shortcut();

    // Capture the previous accelerator BEFORE touching the OS — if the new
    // registration fails, we leave it untouched. Previously we
    // unregistered-old THEN register-new; a failure mid-sequence orphaned
    // the user (old gone, new not installed) and the renderer's optimistic
    // settings UI reverted state but the OS state was "no shortcut".
    let prev: Option<String> = CURRENT_ACCELERATOR.lock().ok().and_then(|m| m.clone());

    // Same chord re-register is a no-op at the OS level: unregister then
    // re-register so the duplicate-registration error doesn't propagate.
    if prev.as_deref() == Some(accelerator) {
        if let Ok(prev_shortcut) = parse_accelerator(accelerator) {
            let _ = gs.unregister(prev_shortcut);
        }
        gs.register(shortcut)
            .map_err(|e| format!("注册失败: {}", e))?;
        // CURRENT_ACCELERATOR already points to this accel; no state change.
        ulog_info!("[global-shortcut] re-registered '{}'", accelerator);
        return Ok(());
    }

    // Different chord: install the new one first. Only on success do we
    // tear down the previous registration — that way a failed register
    // leaves the OS state unchanged and the renderer's "previous accel
    // still works" assumption holds.
    gs.register(shortcut)
        .map_err(|e| format!("注册失败: {}", e))?;

    if let Some(prev_str) = prev.as_deref() {
        if let Ok(prev_shortcut) = parse_accelerator(prev_str) {
            let _ = gs.unregister(prev_shortcut);
        }
    }

    if let Ok(mut guard) = CURRENT_ACCELERATOR.lock() {
        *guard = Some(accelerator.to_string());
    }
    ulog_info!("[global-shortcut] registered '{}'", accelerator);
    Ok(())
}

/// Unregister the currently-active shortcut, if any.
pub fn unregister<R: Runtime>(app: &AppHandle<R>) -> Result<(), String> {
    let prev = CURRENT_ACCELERATOR.lock().ok().and_then(|m| m.clone());
    if let Some(accel) = prev {
        if let Ok(shortcut) = parse_accelerator(&accel) {
            app.global_shortcut()
                .unregister(shortcut)
                .map_err(|e| format!("注销失败: {}", e))?;
        }
        if let Ok(mut guard) = CURRENT_ACCELERATOR.lock() {
            *guard = None;
        }
        ulog_info!("[global-shortcut] unregistered '{}'", accel);
    }
    Ok(())
}

/// Build the plugin with the press handler wired up. Call this when adding
/// the plugin to the Tauri builder (lib.rs). Registering the actual
/// accelerator happens later in `setup_on_startup` once config is readable.
pub fn build_plugin<R: Runtime>() -> tauri::plugin::TauriPlugin<R> {
    tauri_plugin_global_shortcut::Builder::new()
        .with_handler(move |app, shortcut, event| {
            let app_for_handler = app.clone();
            let is_voice = CURRENT_VOICE_ACCELERATOR
                .lock()
                .ok()
                .and_then(|value| value.clone())
                .and_then(|value| parse_accelerator(&value).ok())
                .map(|voice| voice == *shortcut)
                .unwrap_or(false);
            if is_voice && event.state() == ShortcutState::Released {
                let _ = app.run_on_main_thread(move || on_voice_released(&app_for_handler));
                return;
            }
            if event.state() == ShortcutState::Pressed {
                // Tauri docs: window state queries are safest off the GS
                // worker thread. Bounce through main thread.
                let _ = app.run_on_main_thread(move || {
                    if is_voice {
                        on_voice_pressed(&app_for_handler);
                    } else {
                        on_summon_pressed(&app_for_handler);
                    }
                });
            }
        })
        .build()
}

/// Read config and register the configured shortcut on startup.
/// Failure → log + leave summon disabled (frontend will surface via the
/// settings panel; we don't want a one-time conflict to abort app boot).
pub fn setup_on_startup<R: Runtime>(app: &AppHandle<R>) {
    let cfg = load_config();
    if !cfg.enabled {
        ulog_info!("[global-shortcut] disabled in config, skipping registration");
    }
    if cfg.enabled {
        if let Err(e) = register(app, &cfg.accelerator) {
            ulog_warn!(
                "[global-shortcut] startup registration of '{}' failed: {} — leaving inactive",
                cfg.accelerator,
                e
            );
        }
    }
    // Voice registration is independent from the summon shortcut. Disabling
    // the keyboard summon chord must not disable the Lingji HID monitor.
    let voice = load_voice_config();
    if voice.enabled {
        match register_voice(app, &voice.accelerator) {
            Ok(()) => {}
            Err(e) => ulog_warn!("[global-shortcut] voice startup registration failed: {}", e),
        }
    }
}

/// Command: read current config from disk.
#[tauri::command]
pub async fn cmd_get_global_summon_shortcut() -> Result<GlobalSummonConfig, String> {
    Ok(load_config())
}

/// Command: persist new config + re-register/unregister.
///
/// Atomicity: we register/unregister FIRST. Only persist if the OS accepted
/// the change. This is the "fail loud, keep last working value" contract from
/// PRD 0.2.16 §3.3 — frontend stays on its old config on Err, no rollback
/// dance needed there.
#[tauri::command]
pub async fn cmd_set_global_summon_shortcut<R: Runtime>(
    app: AppHandle<R>,
    enabled: bool,
    accelerator: String,
) -> Result<(), String> {
    // Validate even when disabling, so users can't poison config.json with
    // garbage that future enable-toggle would choke on.
    let _ = parse_accelerator(&accelerator)?;

    if enabled {
        register(&app, &accelerator)?;
    } else {
        unregister(&app)?;
    }

    save_config(&GlobalSummonConfig {
        enabled,
        accelerator,
    })?;
    Ok(())
}

#[tauri::command]
pub async fn cmd_get_global_voice_shortcut() -> Result<GlobalVoiceConfig, String> {
    Ok(load_voice_config())
}

#[tauri::command]
pub async fn cmd_set_global_voice_shortcut<R: Runtime>(
    app: AppHandle<R>,
    enabled: bool,
    accelerator: String,
) -> Result<(), String> {
    if native_voice_button(&accelerator).is_none() {
        let _ = parse_accelerator(&accelerator)?;
    }
    let previous = CURRENT_VOICE_ACCELERATOR
        .lock()
        .ok()
        .and_then(|g| g.clone());
    if enabled {
        if previous.as_deref() != Some(accelerator.as_str()) {
            unregister_voice(&app)?;
            if let Err(error) = register_voice(&app, &accelerator) {
                if let Some(previous) = previous.as_deref() {
                    let _ = register_voice(&app, previous);
                }
                return Err(error);
            }
        }
    } else {
        unregister_voice(&app)?;
    }
    let path = config_path().ok_or_else(|| "[global-shortcut] no data dir".to_string())?;
    crate::config_io::with_config_lock(&path, false, move |json| {
        if !json.is_object() {
            *json = serde_json::json!({});
        }
        json.as_object_mut().unwrap().insert(
            "globalVoiceShortcut".to_string(),
            serde_json::json!({ "enabled": enabled, "accelerator": accelerator }),
        );
        Ok(())
    })
    .map(|_| ())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[cfg(target_os = "windows")]
    #[test]
    fn default_voice_accelerator_uses_native_monitor() {
        assert!(native_voice_button(DEFAULT_VOICE_ACCELERATOR).is_some());
    }

    #[cfg(target_os = "windows")]
    #[test]
    fn right_alt_uses_native_monitor_instead_of_register_hotkey() {
        assert!(native_voice_button("AltRight").is_some());
        assert!(native_voice_button("rightalt").is_some());
        assert!(native_voice_button("MouseX1").is_some());
        assert!(native_voice_button("MouseX2").is_some());
        assert!(native_voice_button("LingjiAI").is_some());
        assert!(native_voice_button("Alt+Space").is_none());
    }

    #[cfg(target_os = "windows")]
    #[test]
    fn parses_lingji_ai_press_and_release_reports() {
        let mut report = [0_u8; 41];
        report[..6].copy_from_slice(&[0x0A, 0xD0, 0x99, 0x5B, 0x01, 0x23]);
        assert_eq!(lingji_ai_edge(&report), Some(true));
        report[3] = 0x5E;
        report[5] = 0x24;
        assert_eq!(lingji_ai_edge(&report), Some(false));
        report[3] = 0x5F;
        report[5] = 0x23;
        assert_eq!(lingji_ai_edge(&report), Some(true));
        report[5] = 0x55;
        assert_eq!(lingji_ai_edge(&report), None);
    }

    #[cfg(target_os = "windows")]
    #[test]
    fn accepts_lingji_controls_across_battery_levels() {
        let mut report = [0_u8; 41];
        report[..6].copy_from_slice(&[0x0A, 0xD0, 0x99, 0x00, 0x01, 0x55]);
        for battery_percent in [0_u8, 1, 50, 91, 94, 95, 100] {
            report[3] = battery_percent;
            assert_eq!(lingji_control_code(&report), Some(0x55));
        }
    }

    #[cfg(target_os = "windows")]
    #[test]
    fn builds_lingji_output_report() {
        let report = lingji_output_report(0xA0);
        assert_eq!(report.len(), 10);
        assert_eq!(&report[..3], &[0x0A, 0x03, 0xA0]);
        assert!(report[3..].iter().all(|byte| *byte == 0));
    }

    #[cfg(target_os = "windows")]
    #[test]
    fn preserves_captured_lingji_initialization_sequence() {
        assert_eq!(
            LINGJI_INIT_STEPS,
            &[(0xA0, 3), (0x41, 1_300), (0x26, 6), (0x52, 0)]
        );
    }

    #[cfg(target_os = "windows")]
    #[test]
    fn retries_press_when_previous_release_was_lost() {
        assert_eq!(
            lingji_edge_transition(LingjiButtonState::Up, true),
            LingjiEdgeTransition::Press
        );
        assert_eq!(
            lingji_edge_transition(LingjiButtonState::Down, false),
            LingjiEdgeTransition::Release
        );
        assert_eq!(
            lingji_edge_transition(LingjiButtonState::Down, true),
            LingjiEdgeTransition::RetryPress
        );
        assert_eq!(
            lingji_edge_transition(LingjiButtonState::Up, false),
            LingjiEdgeTransition::Ignore
        );
    }
}
