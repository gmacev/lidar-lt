interface DataLoaderProps {
    message?: string;
}

export function DataLoader({ message = 'Kraunama...' }: DataLoaderProps) {
    return (
        <div className="flex flex-col items-center justify-center gap-2">
            <div className="relative h-16 w-16">
                <div className="absolute inset-0 rounded-full border-2 border-neon-amber/20" />
                <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-neon-amber animate-spin" />
                <div
                    className="absolute inset-2 rounded-full border-2 border-transparent border-b-laser-green animate-spin"
                    style={{ animationDirection: 'reverse', animationDuration: '0.8s' }}
                />
            </div>
            <p className="text-sm text-white/60 uppercase tracking-widest">{message}</p>
        </div>
    );
}
