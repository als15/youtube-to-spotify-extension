import { Card } from "@/components/ui/card";

interface SongCardProps {
  title: string;
  artist: string;
  albumArt?: string;
  matched: boolean;
}

const SongCard = ({ title, artist, albumArt, matched }: SongCardProps) => {
  return (
    <Card className="flex items-center p-4 space-x-4 bg-spotify-light hover:bg-opacity-80 transition-all animate-fadeIn">
      <div className="w-12 h-12 rounded overflow-hidden">
        <img
          src={albumArt || "/placeholder.svg"}
          alt={`${title} album art`}
          className="w-full h-full object-cover"
        />
      </div>
      <div className="flex-1 min-w-0">
        <h3 className="text-white font-medium truncate">{title}</h3>
        <p className="text-gray-400 text-sm truncate">{artist}</p>
      </div>
      <div className="flex-shrink-0">
        {matched ? (
          <span className="text-spotify-green text-sm">✓ Found</span>
        ) : (
          <span className="text-gray-400 text-sm">Searching...</span>
        )}
      </div>
    </Card>
  );
};

export default SongCard;