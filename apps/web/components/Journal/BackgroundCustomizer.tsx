"use client"
/* eslint-disable */
import { useState, useEffect } from "react";
import { X, Upload, Palette, Image as ImageIcon, Zap, Grid3x3, Check } from "lucide-react";
import { Button } from "@/components/ui/button2";
import { createClient } from "@/utils/supabase/client";
import { useTheme } from "@/utilities/context/ThemeContext";

interface BackgroundCustomizerProps {
  isOpen: boolean;
  onClose: () => void;
  onApplyBackground: (type: string, value: any) => void;
  currentBackground: {
    type: string;
    value: any;
  };
}

const BackgroundCustomizer = ({ isOpen, onClose, onApplyBackground, currentBackground }: BackgroundCustomizerProps) => {
  // const { currentTheme } = useTheme();
  const [activeSection, setActiveSection] = useState<'presets' | 'uploads' | 'journal'>('presets');
  const [uploadedImages, setUploadedImages] = useState<string[]>([]);
  const [journalImages, setJournalImages] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [selectedTexture, setSelectedTexture] = useState(0);

  // Preset backgrounds
  const presets = [
    { id: 'transparent', name: 'Transparent', gradient: 'transparent', isTransparent: true },
    { id: 'theme-default', name: 'Theme', gradient: 'linear-gradient(135deg, hsl(var(--background)), hsl(var(--card)))' },
    { id: 'cream', name: 'Cream', gradient: 'linear-gradient(135deg, #fdfcfb 0%, #e2d1c3 100%)' },
    { id: 'sunset', name: 'Sunset', gradient: 'linear-gradient(135deg, #ff9a56 0%, #ff6a88 100%)' },
    { id: 'ocean', name: 'Ocean', gradient: 'linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)' },
    { id: 'lavender', name: 'Lavender', gradient: 'linear-gradient(135deg, #e0c3fc 0%, #8ec5fc 100%)' },
    { id: 'mint', name: 'Mint', gradient: 'linear-gradient(135deg, #d299c2 0%, #fef9d7 100%)' },
    { id: 'peach', name: 'Peach', gradient: 'linear-gradient(135deg, #ffecd2 0%, #fcb69f 100%)' },
    { id: 'sky', name: 'Sky', gradient: 'linear-gradient(135deg, #a1c4fd 0%, #c2e9fb 100%)' },
    { id: 'forest', name: 'Forest', gradient: 'linear-gradient(135deg, #d4fc79 0%, #96e6a1 100%)' },
    { id: 'rose', name: 'Rose', gradient: 'linear-gradient(135deg, #fbc2eb 0%, #a6c1ee 100%)' },
    { id: 'autumn', name: 'Autumn', gradient: 'linear-gradient(135deg, #f6d365 0%, #fda085 100%)' },
  ];

  // Textures
  const textures = [
    { id: 'none', name: 'None', style: {} },
    { id: 'dots', name: 'Dots', style: { backgroundImage: 'radial-gradient(circle, rgba(0,0,0,0.08) 1px, transparent 1px)', backgroundSize: '20px 20px' } },
    { id: 'lines', name: 'Lines', style: { backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 10px, rgba(0,0,0,0.03) 10px, rgba(0,0,0,0.03) 20px)' } },
    { id: 'grid', name: 'Grid', style: { backgroundImage: 'linear-gradient(rgba(0,0,0,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(0,0,0,0.04) 1px, transparent 1px)', backgroundSize: '25px 25px' } },
    { id: 'noise', name: 'Noise', style: { backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='3'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.06'/%3E%3C/svg%3E")` } },
  ];

  useEffect(() => {
    if (isOpen) {
      fetchUploadedImages();
      fetchJournalImages();
    }
  }, [isOpen]);

  // Fetch images from backgrounds folder
  const fetchUploadedImages = async () => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: files, error } = await supabase.storage
      .from('users_cloud')
      .list(`backgrounds/${user.id}`, {
        limit: 50,
        sortBy: { column: 'created_at', order: 'desc' }
      });

    if (!error && files) {
      const urls = files
        .filter(file => file.name !== '.emptyFolderPlaceholder')
        .map(file => {
          const { data } = supabase.storage
            .from('users_cloud')
            .getPublicUrl(`backgrounds/${user.id}/${file.name}`);
          return data.publicUrl;
        });
      setUploadedImages(urls);
    }
  };

  // Fetch images from journal entries
  const fetchJournalImages = async () => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: mediaData, error } = await supabase
      .from('journal_media')
      .select('public_url')
      .eq('user_id', user.id)
      .eq('media_type', 'image')
      .limit(30);

    if (!error && mediaData) {
      const urls = mediaData.map(m => m.public_url).filter(Boolean);
      setJournalImages(urls);
    }
  };

  // Handle image upload
  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Please upload an image file');
      return;
    }

    setUploading(true);
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const timestamp = Date.now();
      const fileName = `bg_${timestamp}_${file.name}`;
      const filePath = `backgrounds/${user.id}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('users_cloud')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('users_cloud')
        .getPublicUrl(filePath);

      setUploadedImages(prev => [publicUrl, ...prev]);
      onApplyBackground('image', publicUrl);
      alert('✨ Image uploaded successfully!');
    } catch (error) {
      console.error('Upload error:', error);
      alert('Failed to upload. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const applyPreset = (preset: typeof presets[0]) => {
    onApplyBackground('preset', preset.gradient);
  };

  const applyImage = (url: string) => {
    onApplyBackground('image', url);
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Overlay */}
      <div 
        className="fixed inset-0 bg-black/30 backdrop-blur-sm z-40 transition-opacity"
        onClick={onClose}
      />

      {/* Sidebar */}
      <div className="fixed right-0 top-0 h-full w-105 bg-background border-l border-border shadow-2xl z-50 flex flex-col animate-in slide-in-from-right duration-300">
        {/* Header */}
        <div className="p-6 border-b border-border bg-linear-to-r from-primary/5 to-transparent">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                <Palette className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-foreground">Background Studio</h2>
                <p className="text-xs text-muted-foreground">Customize your diary's look</p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="rounded-full hover:bg-muted"
            >
              <X className="h-5 w-5" />
            </Button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-border bg-muted/20">
          <button
            onClick={() => setActiveSection('presets')}
            className={`flex-1 py-3 px-4 text-sm font-medium transition-colors relative ${
              activeSection === 'presets'
                ? 'text-primary bg-background'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <div className="flex items-center justify-center gap-2">
              <Zap className="h-4 w-4" />
              <span>Presets</span>
            </div>
            {activeSection === 'presets' && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
            )}
          </button>
          <button
            onClick={() => setActiveSection('uploads')}
            className={`flex-1 py-3 px-4 text-sm font-medium transition-colors relative ${
              activeSection === 'uploads'
                ? 'text-primary bg-background'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <div className="flex items-center justify-center gap-2">
              <Upload className="h-4 w-4" />
              <span>My Uploads</span>
            </div>
            {activeSection === 'uploads' && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
            )}
          </button>
          <button
            onClick={() => setActiveSection('journal')}
            className={`flex-1 py-3 px-4 text-sm font-medium transition-colors relative ${
              activeSection === 'journal'
                ? 'text-primary bg-background'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <div className="flex items-center justify-center gap-2">
              <ImageIcon className="h-4 w-4" />
              <span>Journal</span>
            </div>
            {activeSection === 'journal' && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5bg-primary" />
            )}
          </button>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Presets Section */}
          {activeSection === 'presets' && (
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Choose a Preset</h3>
              <div className="grid grid-cols-2 gap-3">
                {presets.map(preset => (
                  <button
                    key={preset.id}
                    onClick={() => applyPreset(preset)}
                    className={`group relative h-24 rounded-xl overflow-hidden transition-all duration-200 ${
                      currentBackground.type === 'preset' && currentBackground.value === preset.gradient
                        ? 'ring-2 ring-primary ring-offset-2 ring-offset-background shadow-lg scale-95'
                        : 'hover:scale-[0.97] hover:shadow-md'
                    }`}
                    style={{
                      background: preset.isTransparent
                        ? 'repeating-conic-gradient(#e5e7eb 0% 25%, transparent 0% 50%) 50% / 20px 20px'
                        : preset.gradient,
                    }}
                  >
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/5 transition-colors" />
                    <div className="absolute bottom-2 left-2 right-2">
                      <span className="text-xs font-semibold px-2 py-1 rounded bg-white/90 text-gray-800 shadow-sm">
                        {preset.name}
                      </span>
                    </div>
                    {currentBackground.type === 'preset' && currentBackground.value === preset.gradient && (
                      <div className="absolute top-2 right-2">
                        <div className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center">
                          <Check className="h-4 w-4" />
                        </div>
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Uploads Section */}
          {activeSection === 'uploads' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Your Uploads</h3>
                <label className="cursor-pointer">
                  <input
                    type="file"
                    accept="image/*,image/gif"
                    onChange={handleUpload}
                    disabled={uploading}
                    className="hidden"
                  />
                  <div className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors">
                    <Upload className="h-4 w-4" />
                    {uploading ? 'Uploading...' : 'Upload'}
                  </div>
                </label>
              </div>

              {uploadedImages.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Upload className="h-12 w-12 mx-auto mb-3 opacity-20" />
                  <p className="text-sm">No uploads yet</p>
                  <p className="text-xs mt-1">Upload your first background image</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  {uploadedImages.map((url, idx) => (
                    <button
                      key={idx}
                      onClick={() => applyImage(url)}
                      className={`group relative h-28 rounded-xl overflow-hidden transition-all duration-200 ${
                        currentBackground.type === 'image' && currentBackground.value === url
                          ? 'ring-2 ring-primary ring-offset-2 ring-offset-background shadow-lg scale-95'
                          : 'hover:scale-[0.97] hover:shadow-md'
                      }`}
                    >
                      <img src={url} alt="Background" className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
                      {currentBackground.type === 'image' && currentBackground.value === url && (
                        <div className="absolute top-2 right-2">
                          <div className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-lg">
                            <Check className="h-4 w-4" />
                          </div>
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Journal Images Section */}
          {activeSection === 'journal' && (
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                From Your Entries ({journalImages.length})
              </h3>
              {journalImages.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <ImageIcon className="h-12 w-12 mx-auto mb-3 opacity-20" />
                  <p className="text-sm">No journal images yet</p>
                  <p className="text-xs mt-1">Add images to your journal entries</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  {journalImages.map((url, idx) => (
                    <button
                      key={idx}
                      onClick={() => applyImage(url)}
                      className={`group relative h-28 rounded-xl overflow-hidden transition-all duration-200 ${
                        currentBackground.type === 'image' && currentBackground.value === url
                          ? 'ring-2 ring-primary ring-offset-2 ring-offset-background shadow-lg scale-95'
                          : 'hover:scale-[0.97] hover:shadow-md'
                      }`}
                    >
                      <img src={url} alt="Journal" className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
                      {currentBackground.type === 'image' && currentBackground.value === url && (
                        <div className="absolute top-2 right-2">
                          <div className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-lg">
                            <Check className="h-4 w-4" />
                          </div>
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Texture Footer */}
        <div className="p-6 border-t border-border bg-muted/20">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3 flex items-center gap-2">
            <Grid3x3 className="h-4 w-4" />
            Texture Overlay
          </h3>
          <div className="grid grid-cols-5 gap-2">
            {textures.map((texture, idx) => (
              <button
                key={texture.id}
                onClick={() => setSelectedTexture(idx)}
                className={`h-14 rounded-lg transition-all duration-200 overflow-hidden ${
                  selectedTexture === idx
                    ? 'ring-2 ring-primary shadow-lg scale-95'
                    : 'hover:scale-95 hover:shadow-md border border-border'
                }`}
                style={{
                  background: '#f5f5f5',
                  ...texture.style
                }}
              >
                <div className="h-full w-full flex items-center justify-center">
                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-background/80 text-foreground">
                    {texture.name}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </>
  );
};

export default BackgroundCustomizer;
