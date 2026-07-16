import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import type { Message as MessageType } from '@/types/chat';

vi.mock('@/context/ImagePreviewContext', () => ({ useImagePreview: () => ({ openPreview: vi.fn() }) }));
vi.mock('@/analytics', () => ({ track: vi.fn() }));

import Message from './Message';

const message: MessageType = {
  id: 'assistant-speech',
  role: 'assistant',
  content: '请朗读这条消息。',
  timestamp: new Date('2026-07-14T00:00:00Z'),
};

describe('Message Agent Plan speech action', () => {
  it('hides the speaker outside Agent Plan', () => {
    render(<Message message={message} onSpeak={vi.fn()} speechControl={{ visibility: 'hidden', enabled: false, reason: 'not-agent-plan' }} />);
    expect(screen.queryByLabelText('朗读这条回复')).not.toBeInTheDocument();
  });

  it('shows a disabled speaker while Agent Plan speech is unavailable', () => {
    render(<Message message={message} onSpeak={vi.fn()} speechControl={{ visibility: 'visible', enabled: false, reason: 'verification-required' }} />);
    expect(screen.getByLabelText('朗读这条回复')).toBeDisabled();
  });

  it('passes message text to TTS when speech is ready', async () => {
    const onSpeak = vi.fn().mockResolvedValue(undefined);
    render(<Message message={message} onSpeak={onSpeak} speechControl={{ visibility: 'visible', enabled: true, reason: null }} />);

    fireEvent.click(screen.getByLabelText('朗读这条回复'));

    await waitFor(() => expect(onSpeak).toHaveBeenCalledWith('assistant-speech', '请朗读这条消息。'));
  });
});
