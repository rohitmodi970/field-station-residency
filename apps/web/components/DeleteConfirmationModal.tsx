
import React from 'react';
import { AlertTriangle, Trash2 } from 'lucide-react';

interface DeleteConfirmationModalProps {
    showDeleteConfirm: boolean;
    setShowDeleteConfirm: (value: boolean) => void;
    handleDeleteJournal: () => void;
    isDeleting: boolean;
    getCardStyle: () => React.CSSProperties;
    getButtonStyle: (type: 'secondary' | 'danger') => React.CSSProperties;
}

const DeleteConfirmationModal: React.FC<DeleteConfirmationModalProps> = ({
    showDeleteConfirm,
    setShowDeleteConfirm,
    handleDeleteJournal,
    isDeleting,
    getCardStyle,
    getButtonStyle,
}) => {
        if (!showDeleteConfirm) return null;

        return (
            <div className="fixed inset-0 backdrop-blur-md bg-opacity-50 z-50 flex items-center justify-center p-4">
                <div
                    className="rounded-lg shadow-xl max-w-md w-full p-6"
                    style={getCardStyle()}
                >
                    <div className="flex items-center mb-4">
                        <AlertTriangle className="text-red-500 mr-3" size={24} />
                        <h3 className="text-lg font-semibold">Delete Journal Entry</h3>
                    </div>

                    <p className="mb-6 text-sm opacity-80">
                        Are you sure you want to delete this journal entry? This action cannot
                        be undone.
                    </p>

                    <div className="flex gap-3 justify-end">
                        <button
                            onClick={() => setShowDeleteConfirm(false)}
                            className="px-4 py-2 rounded-md transition-colors"
                            style={getButtonStyle('secondary')}
                            disabled={isDeleting}
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleDeleteJournal}
                            className="px-4 py-2 rounded-md transition-colors flex items-center"
                            style={getButtonStyle('danger')}
                            disabled={isDeleting}
                        >
                            {isDeleting ? (
                                <>
                                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2"></div>
                                    Deleting...
                                </>
                            ) : (
                                <>
                                    <Trash2 size={16} className="mr-2" />
                                    Delete
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        );
    };

export { DeleteConfirmationModal };