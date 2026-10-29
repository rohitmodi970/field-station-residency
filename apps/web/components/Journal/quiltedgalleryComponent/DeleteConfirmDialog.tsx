import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/quilted-gallery/ui/dialog";
import { Button } from "@/components/ui/button2";
import { Trash2, Loader2 } from "lucide-react";
import { useTheme } from "@/utilities/context/ThemeContext";

function DeleteConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  isDeleting,
  imageName
}: {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  isDeleting: boolean;
  imageName: string;
}) {
  const { currentTheme, isDarkMode, elementColors } = useTheme();

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent 
        className="sm:max-w-md border-2 shadow-2xl"
        style={{
          backgroundColor: elementColors.background,
          borderColor: currentTheme.medium,
          backdropFilter: 'blur(10px)'
        }}
      >
        <DialogHeader>
          <DialogTitle 
            className="flex items-center gap-2 text-lg font-semibold"
            style={{ color: '#dc2626' }}
          >
            <Trash2 className="h-5 w-5" />
            Delete Image
          </DialogTitle>
          <DialogDescription 
            className="pt-2 text-sm leading-relaxed"
            style={{ color: elementColors.text }}
          >
            Are you sure you want to delete{' '}
            <strong 
              className="font-medium"
              style={{ color: currentTheme.primary }}
            >
              {imageName}
            </strong>
            ?
            <br />
            <span className="text-xs mt-2 block opacity-75">
              This action cannot be undone and will permanently remove the image from your journal and Google Drive.
            </span>
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 mt-6">
          <Button 
            variant="outline" 
            onClick={onClose} 
            disabled={isDeleting}
            className="transition-all duration-200"
            style={{
              backgroundColor: elementColors.background,
              borderColor: currentTheme.medium,
              color: elementColors.text
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = currentTheme.light;
              e.currentTarget.style.borderColor = currentTheme.primary;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = elementColors.background;
              e.currentTarget.style.borderColor = currentTheme.medium;
            }}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={onConfirm}
            disabled={isDeleting}
            className="min-w-[100px] transition-all duration-200"
            style={{
              backgroundColor: '#dc2626',
              borderColor: '#dc2626',
              color: '#ffffff'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#b91c1c';
              e.currentTarget.style.borderColor = '#b91c1c';
              e.currentTarget.style.transform = 'scale(1.02)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = '#dc2626';
              e.currentTarget.style.borderColor = '#dc2626';
              e.currentTarget.style.transform = 'scale(1)';
            }}
          >
            {isDeleting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Deleting...
              </>
            ) : (
              <>
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </>
            )}
          </Button>
        </DialogFooter>
        
        {/* Optional: Add a subtle themed accent border */}
        <div 
          className="absolute inset-0 rounded-lg pointer-events-none"
          style={{
            background: `linear-gradient(135deg, ${currentTheme.primary}10 0%, transparent 50%, ${currentTheme.primary}05 100%)`,
          }}
        />
      </DialogContent>
    </Dialog>
  );
}

export default DeleteConfirmDialog;