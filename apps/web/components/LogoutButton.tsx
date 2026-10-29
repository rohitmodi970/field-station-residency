// In your logout component
import { signOutUser } from '@/actions/auth';
import { useRouter } from 'next/navigation';

const LogoutButton = ({ 
  className = "default-logout-button",
  style = {},
  text = "Sign Out",
  onMouseEnter = () => {},
  onMouseOver = () => {},
  onMouseOut = () => {},
  onFocus = () => {},
  onBlur = () => {},
}) => {
  const router = useRouter();
  
  const handleLogout = async () => {
    try {
      await signOutUser();
      // signOutUser already handles redirect to /
    } catch (error) {
      console.error('Error during logout:', error);
      // On error, still try to go home
      router.push('/');
    }
  };
  

  return (
    <button 
      onClick={handleLogout} 
      className={className}
      style={style}
      onMouseEnter={onMouseEnter}
      onMouseOver={onMouseOver}
      onMouseOut={onMouseOut}
      onFocus={onFocus}
      onBlur={onBlur}
    >
      {text}
    </button>
  );
};

export default LogoutButton;