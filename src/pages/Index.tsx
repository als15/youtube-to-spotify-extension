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
    try {
      setIsScanning(true);
      // Get current tab URL
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab.url?.includes('youtube.com/playlist')) {
        toast({
          title: "Error",
          description: "Please navigate to a YouTube playlist page",
        });
        return;
      }

      // For now, using mock data
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

      await new Promise((resolve) => setTimeout(resolve, 1500));
      setSongs(mockSongs);
      
      toast({
        title: "Playlist Scanned",
        description: "Found 3 songs from your YouTube playlist",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to scan playlist",
      });
    } finally {
      setIsScanning(false);
    }
  };

  const handleCreatePlaylist = async () => {
    toast({
      title: "Creating Playlist",
      description: "Your Spotify playlist is being created...",
    });
  };

  return (
    <div className="w-[400px] h-[600px] bg-spotify-dark p-4 overflow-y-auto">
      <div className="space-y-4">
        <div className="text-center">
          <h1 className="text-xl font-bold text-white mb-2">
            YouTube to Spotify
          </h1>
          <p className="text-gray-400 text-sm">
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