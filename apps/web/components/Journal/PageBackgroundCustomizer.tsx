"use client"
import { useState, useEffect } from "react";
import { X, Palette, ImageIcon, Upload } from "lucide-react";
import { Button } from "@/components/ui/button2";
import { createClient } from "@/utils/supabase/client";

// Define types for background options
type GradientBackground = {
  type: "gradient";
  name: string;
  value: string;
  className?: string;
};

type SolidBackground = {
  type: "solid";
  name: string;
  value: string;
};

type ImageBackground = {
  type: "image";
  name: string;
  value: string;
};

type CustomGradientBackground = {
  type: "customGradient";
  name: string;
  value: {
    color1: string;
    color2: string;
    direction: string;
  };
};

type BackgroundOption =
  | GradientBackground
  | SolidBackground
  | ImageBackground
  | CustomGradientBackground;

interface PageBackgroundCustomizerProps {
  isOpen: boolean;
  onClose: () => void;
  onApplyBackground: (background: BackgroundOption) => void;
  currentBackground: BackgroundOption;
  entryImages?: string[];
}

// Predefined background options
const backgroundPresets: BackgroundOption[] = [
  {
    type: "gradient",
    name: "Sunset",
    value: "linear-gradient(to bottom right, #fed7aa, #fda4af)",
    className: "bg-gradient-to-br from-orange-200 to-rose-300"
  },
  {
    type: "gradient",
    name: "Ocean",
    value: "linear-gradient(to bottom right, #7dd3fc, #3b82f6)",
    className: "bg-gradient-to-br from-sky-300 to-blue-500"
  },
  {
    type: "gradient",
    name: "Forest",
    value: "linear-gradient(to bottom right, #86efac, #22c55e)",
    className: "bg-gradient-to-br from-green-300 to-green-500"
  },
  {
    type: "gradient",
    name: "Lavender",
    value: "linear-gradient(to bottom right, #c4b5fd, #a78bfa)",
    className: "bg-gradient-to-br from-violet-300 to-violet-400"
  },
  {
    type: "gradient",
    name: "Rose",
    value: "linear-gradient(to bottom right, #fda4af, #fb7185)",
    className: "bg-gradient-to-br from-rose-300 to-rose-400"
  },
  {
    type: "gradient",
    name: "Amber",
    value: "linear-gradient(to bottom right, #fcd34d, #f59e0b)",
    className: "bg-gradient-to-br from-yellow-300 to-amber-500"
  },
  {
    type: "image",
    name: "Rainbow Blur 1",
    value: "https://images.unsplash.com/photo-1707742984673-ae30d982bdec?q=80&w=2532&auto=format&fit=crop"
  },
  {
    type: "image",
    name: "Rainbow Blur 2",
    value: "https://images.unsplash.com/photo-1729575846511-f499d2e17d79?q=80&w=2532&auto=format&fit=crop"
  },
  {
    type: "image",
    name: "Rainbow Blur 3",
    value: "https://images.unsplash.com/photo-1729601648807-3c45ee96343d?q=80&w=2532&auto=format&fit=crop"
  },
  {
    type: "image",
    name: "Risograph 1",
    value: "/Risograph1.png"
  },
  {
    type: "image",
    name: "Risograph 2",
    value: "/Risograph2.png"
  },
  {
    type: "image",
    name: "Risograph 3",
    value: "/Risograph3.png"
  },
  {
    type: "image",
    name: "Risograph 4",
    value: "/Risograph4.png"
  },
];

// Helper function to convert Tailwind direction to CSS direction
const tailwindToCssDirection = (tailwindDirection: string): string => {
  const directionMap: { [key: string]: string } = {
    "to-r": "to right",
    "to-l": "to left",
    "to-t": "to top",
    "to-b": "to bottom",
    "to-tr": "to top right",
    "to-tl": "to top left",
    "to-br": "to bottom right",
    "to-bl": "to bottom left"
  };
  return directionMap[tailwindDirection] || "to right";
};

const PageBackgroundCustomizer = ({
  isOpen,
  onClose,
  onApplyBackground,
  currentBackground,
  entryImages = []
}: PageBackgroundCustomizerProps) => {
  const [activeTab, setActiveTab] = useState("presets");
  
  // Custom background states
  const [customColor, setCustomColor] = useState("#FFFFFF");
  const [gradientColor1, setGradientColor1] = useState("#FFFFFF");
  const [gradientColor2, setGradientColor2] = useState("#EEEEEE");
  const [gradientDirection, setGradientDirection] = useState("to-r");
  const [customImageUrl, setCustomImageUrl] = useState("");
  
  // Upload and backgrounds state
  const [uploadedBackgrounds, setUploadedBackgrounds] = useState<string[]>([]);
  const [uploadingBackground, setUploadingBackground] = useState(false);
  
  // Fetch uploaded backgrounds from users_cloud/backgrounds folder
  useEffect(() => {
    if (isOpen) {
      fetchUploadedBackgrounds();
    }
  }, [isOpen]);
  
  const fetchUploadedBackgrounds = async () => {
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) return;
      
      const { data: files, error } = await supabase.storage
        .from('users_cloud')
        .list(`backgrounds/${user.id}`, {
          limit: 50,
          sortBy: { column: 'created_at', order: 'desc' }
        });
      
      if (error) {
        console.error('Error fetching backgrounds:', error);
        return;
      }
      
      if (files) {
        const backgroundUrls = files
          .filter(file => !file.name.startsWith('.'))
          .map(file => {
            const { data } = supabase.storage
              .from('users_cloud')
              .getPublicUrl(`backgrounds/${user.id}/${file.name}`);
            return data.publicUrl;
          });
        setUploadedBackgrounds(backgroundUrls);
      }
    } catch (error) {
      console.error('Error in fetchUploadedBackgrounds:', error);
    }
  };
  
  const handleBackgroundUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    // Check file type
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      alert('Please upload a valid image file (JPG, PNG, GIF, or WebP)');
      return;
    }
    
    // Check file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      alert('File size must be less than 10MB');
      return;
    }
    
    try {
      setUploadingBackground(true);
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        alert('Please login to upload backgrounds');
        return;
      }
      
      const timestamp = Date.now();
      const fileName = `bg_${timestamp}_${file.name}`;
      const filePath = `backgrounds/${user.id}/${fileName}`;
      
      const { error: uploadError } = await supabase.storage
        .from('users_cloud')
        .upload(filePath, file);
      
      if (uploadError) {
        console.error('Upload error:', uploadError);
        alert('Failed to upload background');
        return;
      }
      
      // Get public URL
      const { data } = supabase.storage
        .from('users_cloud')
        .getPublicUrl(filePath);
      
      // Apply the uploaded background immediately
      onApplyBackground({
        type: "image",
        name: `Uploaded ${file.name}`,
        value: data.publicUrl
      });
      
      // Refresh the list
      await fetchUploadedBackgrounds();
      
      // Reset file input
      e.target.value = '';
    } catch (error) {
      console.error('Error uploading background:', error);
      alert('Failed to upload background');
    } finally {
      setUploadingBackground(false);
    }
  };

  // Helper function to render background preview
  const getBackgroundStyle = (bg: BackgroundOption) => {
    if (bg.type === "image") {
      return {
        backgroundImage: `url(${bg.value})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center'
      };
    } else if (bg.type === "solid") {
      return { backgroundColor: bg.value };
    } else if (bg.type === "gradient") {
      return { backgroundImage: bg.value };
    } else if (bg.type === "customGradient") {
      const { color1, color2, direction } = bg.value;
      return {
        backgroundImage: `linear-gradient(${tailwindToCssDirection(direction)}, ${color1}, ${color2})`
      };
    }
    return {};
  };

  // Check if background is selected
  const isBackgroundSelected = (bg: BackgroundOption) => {
    if (currentBackground.type !== bg.type) return false;
    if (bg.type === "customGradient" && currentBackground.type === "customGradient") {
      return JSON.stringify(currentBackground.value) === JSON.stringify(bg.value);
    }
    return currentBackground.value === bg.value;
  };

  const applyCustomColor = () => {
    onApplyBackground({
      type: "solid",
      name: "Custom Color",
      value: customColor
    });
  };

  const applyCustomGradient = () => {
    onApplyBackground({
      type: "customGradient",
      name: "Custom Gradient",
      value: {
        color1: gradientColor1,
        color2: gradientColor2,
        direction: gradientDirection
      }
    });
  };

  const applyCustomImageUrl = () => {
    if (customImageUrl.trim()) {
      onApplyBackground({
        type: "image",
        name: "Custom Image URL",
        value: customImageUrl
      });
    }
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40 transition-opacity"
        onClick={onClose}
      />

      {/* Sidebar */}
      <div className="fixed left-0 top-0 h-full w-96 bg-background/98 backdrop-blur-xl border-r-2 border-border/50 shadow-2xl z-50 overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-background/95 backdrop-blur-xl border-b border-border/50 p-6 z-10">
          <div className="flex justify-between items-start">
            <div>
              <h3 className="text-2xl font-bold text-foreground flex items-center gap-2">
                <Palette className="h-6 w-6 text-primary" />
                Page Background
              </h3>
              <p className="text-sm text-muted-foreground mt-1.5">Customize your page appearance</p>
            </div>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={onClose}
              className="h-9 w-9 p-0 hover:bg-muted/80 rounded-full"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Tabs */}
        <div className="border-b border-border/30 bg-muted/20">
          <div className="flex px-6 overflow-x-auto">
            <button
              className={`px-3 py-3 text-sm font-medium transition-all border-b-2 whitespace-nowrap ${
                activeTab === 'presets' 
                  ? 'border-primary text-primary' 
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
              onClick={() => setActiveTab('presets')}
            >
              Presets
            </button>
            <button
              className={`px-3 py-3 text-sm font-medium transition-all border-b-2 whitespace-nowrap ${
                activeTab === 'uploads' 
                  ? 'border-primary text-primary' 
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
              onClick={() => setActiveTab('uploads')}
            >
              My Uploads
            </button>
            <button
              className={`px-3 py-3 text-sm font-medium transition-all border-b-2 whitespace-nowrap ${
                activeTab === 'journal' 
                  ? 'border-primary text-primary' 
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
              onClick={() => setActiveTab('journal')}
            >
              Journal
            </button>
            <button
              className={`px-3 py-3 text-sm font-medium transition-all border-b-2 whitespace-nowrap ${
                activeTab === 'solid' 
                  ? 'border-primary text-primary' 
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
              onClick={() => setActiveTab('solid')}
            >
              Solid
            </button>
            <button
              className={`px-3 py-3 text-sm font-medium transition-all border-b-2 whitespace-nowrap ${
                activeTab === 'gradient' 
                  ? 'border-primary text-primary' 
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
              onClick={() => setActiveTab('gradient')}
            >
              Gradient
            </button>
            <button
              className={`px-3 py-3 text-sm font-medium transition-all border-b-2 whitespace-nowrap ${
                activeTab === 'image' 
                  ? 'border-primary text-primary' 
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
              onClick={() => setActiveTab('image')}
            >
              Image URL
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Presets Tab */}
          {activeTab === 'presets' && (
            <div className="space-y-6">
              <div>
                <h4 className="text-sm font-semibold mb-3 text-foreground">Gradient Presets</h4>
                <div className="grid grid-cols-3 gap-3">
                  {backgroundPresets.filter(bg => bg.type === 'gradient').map((bg, index) => (
                    <button
                      key={index}
                      onClick={() => onApplyBackground(bg)}
                      className={`aspect-square rounded-xl transition-all duration-300 border-2 ${
                        isBackgroundSelected(bg) 
                          ? 'ring-2 ring-primary ring-offset-2 ring-offset-background scale-95 shadow-lg border-primary' 
                          : 'border-border/40 hover:border-primary/50 hover:shadow-md hover:scale-[0.97]'
                      }`}
                      style={getBackgroundStyle(bg)}
                      title={bg.name}
                    >
                      <div className="h-full w-full flex items-center justify-center">
                        <span className="text-xs font-bold text-white drop-shadow-md px-2 py-1 rounded bg-black/20 backdrop-blur-sm">
                          {bg.name}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <h4 className="text-sm font-semibold mb-3 text-foreground">Image Presets</h4>
                <div className="grid grid-cols-3 gap-3">
                  {backgroundPresets.filter(bg => bg.type === 'image').map((bg, index) => (
                    <button
                      key={index}
                      onClick={() => onApplyBackground(bg)}
                      className={`aspect-square rounded-xl transition-all duration-300 border-2 overflow-hidden ${
                        isBackgroundSelected(bg) 
                          ? 'ring-2 ring-primary ring-offset-2 ring-offset-background scale-95 shadow-lg border-primary' 
                          : 'border-border/40 hover:border-primary/50 hover:shadow-md hover:scale-[0.97]'
                      }`}
                      style={getBackgroundStyle(bg)}
                      title={bg.name}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* My Uploads Tab */}
          {activeTab === 'uploads' && (
            <div className="space-y-6">
              {/* Upload Section */}
              <div className="p-4 bg-muted/20 rounded-xl border border-border/40">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
                    <Upload className="h-4 w-4 text-primary" />
                    Upload Background
                  </h4>
                </div>
                <input
                  type="file"
                  accept="image/*,image/gif"
                  onChange={handleBackgroundUpload}
                  disabled={uploadingBackground}
                  className="w-full px-4 py-3 border-2 border-dashed border-border/60 rounded-xl text-sm bg-background/50 text-foreground hover:border-primary/50 transition-colors file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-primary-foreground hover:file:bg-primary/90 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                />
                {uploadingBackground && (
                  <div className="flex items-center gap-2 mt-3 text-sm text-primary">
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-primary border-t-transparent" />
                    <span>Uploading...</span>
                  </div>
                )}
                <p className="text-xs text-muted-foreground mt-2">Supports: JPG, PNG, GIF, WebP (Max 10MB)</p>
              </div>

              {/* Uploaded Backgrounds */}
              {uploadedBackgrounds.length > 0 ? (
                <div>
                  <h4 className="text-sm font-semibold mb-3 text-foreground flex items-center gap-2">
                    <ImageIcon className="h-4 w-4 text-primary" />
                    Your Uploaded Backgrounds ({uploadedBackgrounds.length})
                  </h4>
                  <div className="grid grid-cols-3 gap-3 max-h-96 overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-primary/20 scrollbar-track-transparent">
                    {uploadedBackgrounds.map((imgUrl, index) => (
                      <button
                        key={index}
                        onClick={() => onApplyBackground({
                          type: "image",
                          name: `Uploaded Background ${index + 1}`,
                          value: imgUrl
                        })}
                        className={`aspect-square rounded-xl transition-all duration-300 border-2 overflow-hidden group ${
                          currentBackground.type === "image" && currentBackground.value === imgUrl
                            ? 'ring-2 ring-primary ring-offset-2 ring-offset-background scale-95 shadow-lg border-primary' 
                            : 'border-border/40 hover:border-primary/50 hover:shadow-md hover:scale-[0.97]'
                        }`}
                      >
                        <img 
                          src={imgUrl} 
                          alt={`Uploaded background ${index + 1}`}
                          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                        />
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <ImageIcon className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p className="text-sm">No uploaded backgrounds yet</p>
                  <p className="text-xs mt-1">Upload your first background above</p>
                </div>
              )}
            </div>
          )}

          {/* Journal Images Tab */}
          {activeTab === 'journal' && (
            <div className="space-y-6">
              {entryImages.length > 0 ? (
                <div>
                  <h4 className="text-sm font-semibold mb-3 text-foreground flex items-center gap-2">
                    <ImageIcon className="h-4 w-4 text-primary" />
                    Images from Your Journal Entries ({entryImages.length})
                  </h4>
                  <div className="grid grid-cols-3 gap-3 max-h-96 overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-primary/20 scrollbar-track-transparent">
                    {entryImages.map((imgUrl, index) => (
                      <button
                        key={index}
                        onClick={() => onApplyBackground({
                          type: "image",
                          name: `Journal Image ${index + 1}`,
                          value: imgUrl
                        })}
                        className={`aspect-square rounded-xl transition-all duration-300 border-2 overflow-hidden group ${
                          currentBackground.type === "image" && currentBackground.value === imgUrl
                            ? 'ring-2 ring-primary ring-offset-2 ring-offset-background scale-95 shadow-lg border-primary' 
                            : 'border-border/40 hover:border-primary/50 hover:shadow-md hover:scale-[0.97]'
                        }`}
                      >
                        <img 
                          src={imgUrl} 
                          alt={`Journal image ${index + 1}`}
                          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                        />
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <ImageIcon className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p className="text-sm">No journal images yet</p>
                  <p className="text-xs mt-1">Images from your journal entries will appear here</p>
                </div>
              )}
            </div>
          )}

          {/* Solid Color Tab */}
          {activeTab === 'solid' && (
            <div className="space-y-4">
              <h4 className="text-sm font-semibold mb-3 text-foreground">Pick a Solid Color</h4>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded overflow-hidden border border-border">
                  <input
                    type="color"
                    value={customColor}
                    onChange={(e) => setCustomColor(e.target.value)}
                    className="w-12 h-12 cursor-pointer transform translate-x-[-2px] translate-y-[-2px]"
                  />
                </div>
                <input
                  type="text"
                  value={customColor}
                  onChange={(e) => setCustomColor(e.target.value)}
                  placeholder="#FFFFFF"
                  className="flex-1 px-3 py-2 border border-border rounded-md text-sm bg-background text-foreground"
                />
              </div>
              <div
                className="h-32 rounded-xl border-2 border-border/40"
                style={{ backgroundColor: customColor }}
              />
              <Button 
                onClick={applyCustomColor}
                className="w-full h-11 rounded-xl font-semibold"
              >
                Apply Color
              </Button>
            </div>
          )}

          {/* Gradient Tab */}
          {activeTab === 'gradient' && (
            <div className="space-y-4">
              <h4 className="text-sm font-semibold mb-3 text-foreground">Create a Custom Gradient</h4>
              
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium mb-2 text-foreground">Color 1</label>
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded overflow-hidden border border-border">
                      <input
                        type="color"
                        value={gradientColor1}
                        onChange={(e) => setGradientColor1(e.target.value)}
                        className="w-10 h-10 cursor-pointer transform translate-x-[-2px] translate-y-[-2px]"
                      />
                    </div>
                    <input
                      type="text"
                      value={gradientColor1}
                      onChange={(e) => setGradientColor1(e.target.value)}
                      placeholder="#FFFFFF"
                      className="flex-1 px-2 py-1 border border-border rounded text-sm bg-background text-foreground"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2 text-foreground">Color 2</label>
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded overflow-hidden border border-border">
                      <input
                        type="color"
                        value={gradientColor2}
                        onChange={(e) => setGradientColor2(e.target.value)}
                        className="w-10 h-10 cursor-pointer transform translate-x-[-2px] translate-y-[-2px]"
                      />
                    </div>
                    <input
                      type="text"
                      value={gradientColor2}
                      onChange={(e) => setGradientColor2(e.target.value)}
                      placeholder="#EEEEEE"
                      className="flex-1 px-2 py-1 border border-border rounded text-sm bg-background text-foreground"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2 text-foreground">Direction</label>
                <select
                  value={gradientDirection}
                  onChange={(e) => setGradientDirection(e.target.value)}
                  className="w-full px-3 py-2 border border-border rounded-md text-sm bg-background text-foreground"
                >
                  <option value="to-r">Left to Right</option>
                  <option value="to-l">Right to Left</option>
                  <option value="to-t">Bottom to Top</option>
                  <option value="to-b">Top to Bottom</option>
                  <option value="to-tr">Bottom Left to Top Right</option>
                  <option value="to-tl">Bottom Right to Top Left</option>
                  <option value="to-br">Top Left to Bottom Right</option>
                  <option value="to-bl">Top Right to Bottom Left</option>
                </select>
              </div>

              <div
                className="h-32 rounded-xl border-2 border-border/40"
                style={{
                  backgroundImage: `linear-gradient(${tailwindToCssDirection(gradientDirection)}, ${gradientColor1}, ${gradientColor2})`
                }}
              />

              <Button 
                onClick={applyCustomGradient}
                className="w-full h-11 rounded-xl font-semibold"
              >
                Apply Gradient
              </Button>
            </div>
          )}

          {/* Image URL Tab */}
          {activeTab === 'image' && (
            <div className="space-y-4">
              <h4 className="text-sm font-semibold mb-3 text-foreground">Add Custom Image URL</h4>
              <input
                type="text"
                value={customImageUrl}
                onChange={(e) => setCustomImageUrl(e.target.value)}
                placeholder="https://example.com/image.jpg"
                className="w-full px-4 py-3 border-2 border-border/60 rounded-xl text-sm bg-background/50 text-foreground focus:border-primary/50 focus:ring-2 focus:ring-primary/20 transition-all"
              />

              {customImageUrl && (
                <div
                  className="h-48 rounded-xl border-2 border-border/40 bg-cover bg-center"
                  style={{
                    backgroundImage: `url(${customImageUrl})`
                  }}
                />
              )}

              <Button 
                onClick={applyCustomImageUrl}
                disabled={!customImageUrl.trim()}
                className="w-full h-11 rounded-xl font-semibold"
              >
                Apply Image
              </Button>
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default PageBackgroundCustomizer;
