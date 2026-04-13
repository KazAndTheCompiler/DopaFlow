import { useCallback, useEffect, useRef, useState } from 'react';

interface UseMicrophoneOptions {
  onStop?: (blob: Blob, mimeType: string) => void | Promise<void>;
}

interface UseMicrophoneResult {
  isRecording: boolean;
  start: () => Promise<boolean>;
  stop: () => void;
  error: string | null;
}

function pickMimeType(): string {
  const candidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'];
  for (const candidate of candidates) {
    try {
      if (MediaRecorder.isTypeSupported(candidate)) {
        return candidate;
      }
    } catch {}
  }
  return '';
}

function mapMicrophoneError(exc: unknown): string {
  if (exc && typeof exc === 'object' && 'name' in exc) {
    const name = String((exc as { name?: unknown }).name ?? '');
    if (
      name === 'NotAllowedError' ||
      name === 'PermissionDeniedError' ||
      name === 'SecurityError'
    ) {
      return 'Microphone permission was denied by the browser.';
    }
    if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
      return 'No microphone was found.';
    }
    if (name === 'NotReadableError') {
      return 'The microphone is busy or unavailable right now.';
    }
  }
  const message = exc instanceof Error ? exc.message : 'Microphone unavailable';
  return /denied|notallowed|permission/i.test(message)
    ? 'Microphone permission was denied by the browser.'
    : message;
}

export function useMicrophone(options: UseMicrophoneOptions = {}): UseMicrophoneResult {
  const { onStop } = options;
  const [isRecording, setIsRecording] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);

  const stopTracks = useCallback((): void => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }, []);

  const stop = useCallback((): void => {
    const recorder = recorderRef.current;
    if (!recorder) {
      stopTracks();
      setIsRecording(false);
      return;
    }
    recorder.stop();
  }, [stopTracks]);

  const start = useCallback(async (): Promise<boolean> => {
    setError(null);
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      setError('Microphone unavailable');
      return false;
    }
    if (isRecording) {
      return true;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = pickMimeType();
      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);
      streamRef.current = stream;
      recorderRef.current = recorder;
      chunksRef.current = [];
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };
      recorder.onerror = () => {
        setError('The microphone is busy or unavailable right now.');
        setIsRecording(false);
        recorderRef.current = null;
        stopTracks();
      };
      recorder.onstop = () => {
        const finalMimeType = recorder.mimeType || 'audio/webm';
        const blob = new Blob(chunksRef.current, { type: finalMimeType });
        recorderRef.current = null;
        chunksRef.current = [];
        setIsRecording(false);
        stopTracks();
        if (blob.size > 0) {
          void onStop?.(blob, finalMimeType);
        }
      };
      recorder.start(250);
      setIsRecording(true);
      return true;
    } catch (exc) {
      setError(mapMicrophoneError(exc));
      setIsRecording(false);
      recorderRef.current = null;
      stopTracks();
      return false;
    }
  }, [isRecording, onStop, stopTracks]);

  useEffect(
    () => () => {
      recorderRef.current?.stop();
      stopTracks();
    },
    [stopTracks],
  );

  return { isRecording, start, stop, error };
}

export default useMicrophone;
