"use client"
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Users, Eye, MessageSquare, UserPlus, Link2, Mail, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ShareRole } from '@/types/checklist';

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  itemTitle?: string;
}

const roles: { value: ShareRole; label: string; icon: typeof Eye; description: string }[] = [
  { value: 'view', label: 'View only', icon: Eye, description: 'Can see but not edit' },
  { value: 'comment', label: 'Can comment', icon: MessageSquare, description: 'Can view and add comments' },
  { value: 'collaborate', label: 'Collaborator', icon: UserPlus, description: 'Can edit and complete tasks' },
];

const mockContacts = [
  { id: '1', name: 'Sarah Chen', email: 'sarah@example.com', avatar: '' },
  { id: '2', name: 'Alex Rivera', email: 'alex@example.com', avatar: '' },
  { id: '3', name: 'Jordan Kim', email: 'jordan@example.com', avatar: '' },
];

export const ShareModal = ({ isOpen, onClose, itemTitle }: ShareModalProps) => {
  const [selectedContacts, setSelectedContacts] = useState<string[]>([]);
  const [selectedRole, setSelectedRole] = useState<ShareRole>('view');
  const [message, setMessage] = useState('');
  const [copied, setCopied] = useState(false);

  const toggleContact = (id: string) => {
    setSelectedContacts(prev => 
      prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]
    );
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText('https://force.app/share/xyz123');
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShare = () => {
    // Handle share logic
    onClose();
    setSelectedContacts([]);
    setMessage('');
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-foreground/20 backdrop-blur-sm z-50"
          />
          
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className="fixed inset-x-4 top-[10%] md:inset-auto md:left-1/2 md:top-1/2 md:-translate-x-1/2 md:-translate-y-1/2 md:w-full md:max-w-lg z-50 max-h-[80vh] overflow-y-auto"
          >
            <div className="card-elevated p-6 md:p-8">
              {/* Header */}
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-primary/10 text-primary">
                    <Users className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-xl font-display text-foreground">Share with tribe</h2>
                    {itemTitle && (
                      <p className="text-sm text-muted-foreground">"{itemTitle}"</p>
                    )}
                  </div>
                </div>
                <button
                  onClick={onClose}
                  className="p-2 rounded-lg hover:bg-secondary transition-colors"
                >
                  <X className="w-5 h-5 text-muted-foreground" />
                </button>
              </div>

              {/* Privacy Notice */}
              <div className="p-3 rounded-xl bg-balance-soft border border-balance/20 mb-6">
                <p className="text-sm text-balance">
                  🔒 Your checklist is private by default — you choose who to share with
                </p>
              </div>

              {/* Contacts */}
              <div className="mb-6">
                <h3 className="font-medium text-foreground mb-3">Select people</h3>
                <div className="space-y-2">
                  {mockContacts.map((contact) => (
                    <button
                      key={contact.id}
                      onClick={() => toggleContact(contact.id)}
                      className={cn(
                        'w-full flex items-center gap-3 p-3 rounded-xl border-2 transition-all',
                        selectedContacts.includes(contact.id)
                          ? 'border-primary bg-primary/5'
                          : 'border-border hover:border-primary/30'
                      )}
                    >
                      <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center text-muted-foreground font-medium">
                        {contact.name.charAt(0)}
                      </div>
                      <div className="text-left flex-1">
                        <p className="font-medium text-foreground">{contact.name}</p>
                        <p className="text-sm text-muted-foreground">{contact.email}</p>
                      </div>
                      <AnimatePresence>
                        {selectedContacts.includes(contact.id) && (
                          <motion.div
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            exit={{ scale: 0 }}
                            className="w-6 h-6 rounded-full bg-primary flex items-center justify-center"
                          >
                            <Check className="w-4 h-4 text-primary-foreground" />
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </button>
                  ))}
                </div>
              </div>

              {/* Role Selection */}
              <div className="mb-6">
                <h3 className="font-medium text-foreground mb-3">Permission level</h3>
                <div className="flex gap-2">
                  {roles.map((role) => {
                    const Icon = role.icon;
                    return (
                      <button
                        key={role.value}
                        onClick={() => setSelectedRole(role.value)}
                        className={cn(
                          'flex-1 flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition-all',
                          selectedRole === role.value
                            ? 'border-primary bg-primary/5'
                            : 'border-border hover:border-primary/30'
                        )}
                      >
                        <Icon className={cn(
                          'w-5 h-5',
                          selectedRole === role.value ? 'text-primary' : 'text-muted-foreground'
                        )} />
                        <span className="text-xs font-medium">{role.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Message */}
              <div className="mb-6">
                <h3 className="font-medium text-foreground mb-3">Add a note (optional)</h3>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Hey, thought you might want to see this..."
                  className="input-force resize-none h-20"
                />
              </div>

              {/* Copy Link */}
              <button
                onClick={handleCopyLink}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-dashed border-border hover:border-primary/30 transition-all mb-4"
              >
                {copied ? (
                  <>
                    <Check className="w-4 h-4 text-primary" />
                    <span className="text-sm text-primary">Link copied!</span>
                  </>
                ) : (
                  <>
                    <Link2 className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">Copy share link</span>
                  </>
                )}
              </button>

              {/* Actions */}
              <div className="flex gap-3">
                <button onClick={onClose} className="btn-force-secondary flex-1">
                  Cancel
                </button>
                <button 
                  onClick={handleShare}
                  disabled={selectedContacts.length === 0}
                  className={cn(
                    'btn-force-primary flex-1',
                    selectedContacts.length === 0 && 'opacity-50 cursor-not-allowed'
                  )}
                >
                  <Mail className="w-4 h-4" />
                  Share
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
