import { XCircle, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

const getCardStyle = () => ({
  boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
});

const getButtonStyle = (type: string) => ({
  backgroundColor: type === 'primary' ? '#2563EB' : '#E5E7EB',
  color: type === 'primary' ? '#FFFFFF' : '#374151',
});

const isDarkMode = false; // Replace with actual logic to determine dark mode

const ErrorScreen = ({ message }: { message: string }) => (
    <div className="flex justify-center items-center min-h-screen p-4">
      <div className="max-w-lg w-full rounded-lg overflow-hidden shadow-lg" style={getCardStyle()}>
        <div className="p-6 border-b border-red-200" style={{ backgroundColor: isDarkMode ? '#7F1D1D' : '#FEF2F2' }}>
          <div className="flex items-center">
            <div className="flex-shrink-0 bg-red-100 rounded-full p-2" style={{ backgroundColor: isDarkMode ? '#991B1B' : '#FEE2E2' }}>
              <XCircle size={24} className="text-red-600" />
            </div>
            <h2 className="ml-3 text-xl font-bold text-red-700">Error</h2>
          </div>
        </div>
        <div className="p-6">
          <p className="mb-6" style={{ color: isDarkMode ? '#FCA5A5' : '#B91C1C' }}>{message}</p>
          <Link 
            href="/dashboard" 
            className="inline-flex items-center px-4 py-2 rounded-md transition-colors"
            style={getButtonStyle('primary')}
          >
            <ArrowLeft size={16} className="mr-2" />
            Back to Journals
          </Link>
        </div>
      </div>
    </div>
  );
  export default ErrorScreen;
