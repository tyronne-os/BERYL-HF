import { useRef, useEffect, useImperativeHandle, forwardRef, useState } from 'react';

export interface AmandaPlayerHandle {
  play: (video_b64: string, mime?: string) => void;
  stop: () => void;
}

const AmandaPlayer = forwardRef<AmandaPlayerHandle, {
  stillSrc: string | null;
  shot?: 'full' | 'close';
}>(({ stillSrc, shot = 'full' }, ref) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const blobRef = useRef<string | null>(null);

  const revoke = () => {
    if (blobRef.current) { URL.revokeObjectURL(blobRef.current); blobRef.current = null; }
  };

  useImperativeHandle(ref, () => ({
    play: (video_b64: string, mime = 'video/mp4') => {
      revoke();
      const bytes = Uint8Array.from(atob(video_b64), c => c.charCodeAt(0));
      const blob = new Blob([bytes], { type: mime });
      const url = URL.createObjectURL(blob);
      blobRef.current = url;
      setVideoUrl(url);
      setPlaying(true);
    },
    stop: () => {
      videoRef.current?.pause();
      setPlaying(false);
      setVideoUrl(null);
      revoke();
    },
  }), []);

  useEffect(() => () => revoke(), []);

  const onEnded = () => {
    // loop the last frame — hide video, show still
    setPlaying(false);
    setVideoUrl(null);
    revoke();
  };

  const cls = "max-h-[88%] max-w-[88%] rounded-xl shadow-[0_20px_60px_rgba(0,0,0,0.6)] border border-midnight-800 object-contain";

  return (
    <div className="relative flex items-center justify-center w-full h-full">
      {/* still image — always rendered, hidden under video when playing */}
      {stillSrc && (
        <img
          src={stillSrc}
          alt="Amanda"
          className={cls}
          style={{ display: playing ? 'none' : 'block' }}
        />
      )}
      {/* video — rendered only when we have a URL */}
      {videoUrl && (
        <video
          ref={videoRef}
          src={videoUrl}
          autoPlay
          playsInline
          onEnded={onEnded}
          onError={onEnded}
          className={cls}
          style={{ display: playing ? 'block' : 'none' }}
        />
      )}
      {/* LIVE pulse badge */}
      {playing && (
        <div className="absolute top-3 left-3 flex items-center gap-1.5 bg-midnight-950/80 backdrop-blur border border-rose-500/40 rounded-full px-2.5 py-1 text-[10px] font-mono font-bold text-rose-400">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-rose-500" />
          </span>
          LIVE
        </div>
      )}
    </div>
  );
});

export default AmandaPlayer;
