import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuth } from '../../context/AuthContext';

const LoginPage = ({ onLogin }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const { loginWithEmailAndPassword } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      await loginWithEmailAndPassword(email, password, rememberMe);
      toast.success('Login successful!');
      navigate('/');
    } catch (error) {
      console.error('Login error:', error);
      const message = error?.message || 'Login failed';
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center" style={{ backgroundColor: '#b4b338' }}>
      {/* Header with logo */}
      <div className="text-center mb-8">
        <div className="mb-4">
          <div className="w-48 h-48 mx-auto bg-yellow-200 rounded-full flex items-center justify-center border-4 border-black">
            <div className="text-center">
              <div className="text-4xl font-bold text-black">JBO</div>
              <div className="text-lg text-black font-script">Arts & Crafts</div>
              <div className="text-lg text-black font-script">Trading</div>
            </div>
          </div>
        </div>
        <h1 className="text-white text-2xl font-bold">JBO Arts and Crafts Trading</h1>
      </div>

      {/* Login Card */}
      <div className="bg-white p-8 rounded-lg shadow-lg w-full max-w-md">
        <h2 className="text-xl font-bold text-center mb-6 text-gray-800">Login</h2>
        
        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label className="block text-gray-700 text-sm font-medium mb-2">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
              placeholder="Enter your email"
            />
          </div>

          <div className="mb-4">
            <label className="block text-gray-700 text-sm font-medium mb-2">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
              placeholder="Enter your password"
            />
          </div>

          <div className="mb-6">
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="mr-2"
              />
              <span className="text-gray-600 text-sm">Remember me?</span>
            </label>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-2 px-4 bg-yellow-600 hover:bg-yellow-700 text-white font-medium rounded-md transition duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ backgroundColor: '#b4b338' }}
          >
            {isLoading ? 'Logging in...' : 'LOGIN'}
          </button>

          <div className="text-center mt-4">
            <a href="#" className="text-gray-600 text-sm hover:underline">
              Forgot password?
            </a>
          </div>
        </form>
      </div>
    </div>
  );
};

export default LoginPage; 