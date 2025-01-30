import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import SongCard from "@/components/SongCard";
import { Music, Loader2 } from "lucide-react";

interface Song {
  id: string;
  title: string;
  artist: string;
  albumArt?: string;
  matched: boolean;
}

const Index = () => {
  const [isScanning, setIsScanning] = useState(false);
  const [songs, setSongs] = useState<Song[]>([]);
  const { toast } = useToast();

  const handleScanPlaylist = async () => {
    setIsScanning(true);
    // Simulated scan for demo
    const mockSongs: Song[] = [
      {
        id: "1",
        title: "Bohemian Rhapsody",
        artist: "Queen",
        albumArt: "https://via.placeholder.com/48",
        matched: true,
      },
      {
        id: "2",
        title: "Stairway to Heaven",
        artist: "Led Zeppelin",
        albumArt: "https://via.placeholder.com/48",
        matched: true,
      },
      {
        id: "3",
        title: "Hotel California",
        artist: "Eagles",
        albumArt: "https://via.placeholder.com/48",
        matched: false,
      },
    ];

    // Simulate API delay
    await new Promise((resolve) => setTimeout(resolve, 1500));
    setSongs(mockSongs);
    setIsScanning(false);
    
    toast({
      title: "Playlist Scanned",
      description: "Found 3 songs from your YouTube playlist",
    });
  };

  const handleCreatePlaylist = async () => {
    toast({
      title: "Creating Playlist",
      description: "Your Spotify playlist is being created...",
    });
    // Add actual Spotify API integration here
  };

  return (
    <div className="min-h-screen bg-spotify-dark p-6">
      <div className="max-w-md mx-auto space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-white mb-2">
            YouTube to Spotify
          </h1>
          <p className="text-gray-400">
            Convert your YouTube playlist to Spotify in one click
          </p>
        </div>

        <div className="space-y-4">
          <Button
            className="w-full bg-spotify-green hover:bg-spotify-green/90"
            onClick={handleScanPlaylist}
            disabled={isScanning}
          >
            {isScanning ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Scanning Playlist...
              </>
            ) : (
              <>
                <Music className="mr-2 h-4 w-4" />
                Scan YouTube Playlist
              </>
            )}
          </Button>

          {songs.length > 0 && (
            <div className="space-y-4">
              <div className="space-y-2">
                {songs.map((song) => (
                  <SongCard key={song.id} {...song} />
                ))}
              </div>

              <Button
                className="w-full bg-spotify-green hover:bg-spotify-green/90"
                onClick={handleCreatePlaylist}
              >
                Create Spotify Playlist
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Index;