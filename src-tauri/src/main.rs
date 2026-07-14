// BlexAgent is a desktop GUI in both debug and release builds. Keep the GUI
// binary console-free on Windows; explicit CLI invocations attach to their
// caller's console in `cli::run` so command output remains available.
#![cfg_attr(target_os = "windows", windows_subsystem = "windows")]

fn main() {
    let args: Vec<String> = std::env::args().skip(1).collect();

    // CLI mode: detect known subcommands/flags and route to CLI handler.
    // This avoids starting the GUI, running cleanup_stale_sidecars (which kills
    // running sidecars), and triggering the single-instance window focus.
    if app_lib::is_cli_mode(&args) {
        std::process::exit(app_lib::run_cli(&args));
    }

    // GUI mode: normal Tauri app
    app_lib::run();
}
