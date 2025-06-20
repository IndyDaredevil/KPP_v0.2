import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import Button from '../ui/Button';

const Header: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, isAuthenticated, logout } = useAuth();

  const navigation = [
    { name: 'Dashboard', href: '/dashboard' },
    { name: 'Listings', href: '/listings' },
    { name: 'Sales', href: '/sales' },
    { name: 'Historical', href: '/historical' },
  ];

  const isActive = (path: string) => location.pathname === path;

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <header className="bg-kaspa-accent-medium-blue shadow-lg border-b border-kaspa-primary-green/30 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <div className="flex items-center">
            <Link to="/dashboard" className="flex items-center space-x-3 group">
              <img 
                src="/image copy.png" 
                alt="Kaspa Logo"
                className="w-10 h-10 transition-all duration-200 transform group-hover:scale-105"
              />
              <div className="flex flex-col">
                <span className="text-xl font-bold text-white font-kaspa-header">
                  Kaspa<span className="kaspa-text-gradient">NFT</span>
                </span>
                <span className="text-xs text-kaspa-primary-gray font-kaspa-body -mt-1">
                  Marketplace Analytics
                </span>
              </div>
            </Link>
          </div>

          {/* Navigation */}
          {isAuthenticated && (
            <nav className="hidden md:flex space-x-1">
              {navigation.map((item) => (
                <Link
                  key={item.name}
                  to={item.href}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 font-kaspa-body ${
                    isActive(item.href)
                      ? 'bg-kaspa-primary-green/20 text-kaspa-secondary-green border border-kaspa-primary-green/30 shadow-md'
                      : 'text-kaspa-primary-gray hover:text-kaspa-secondary-green hover:bg-kaspa-primary-green/10 hover:border hover:border-kaspa-primary-green/20'
                  }`}
                >
                  {item.name}
                </Link>
              ))}
            </nav>
          )}

          {/* User info and actions */}
          <div className="flex items-center space-x-4">
            {isAuthenticated && user ? (
              <>
                <div className="hidden sm:flex flex-col items-end">
                  <span className="text-sm font-medium text-white font-kaspa-body">{user.email}</span>
                  <span className="kaspa-badge text-xs">{user.role}</span>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleLogout}
                  className="text-kaspa-primary-gray hover:text-white"
                >
                  Sign out
                </Button>
              </>
            ) : (
              <div className="flex items-center space-x-2">
                <Link to="/login">
                  <Button variant="ghost" size="sm">
                    Sign in
                  </Button>
                </Link>
                <Link to="/register">
                  <Button size="sm">
                    Sign up
                  </Button>
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Mobile navigation */}
      {isAuthenticated && (
        <div className="md:hidden border-t border-kaspa-primary-green/20 bg-kaspa-accent-dark-blue/50">
          <div className="px-2 pt-2 pb-3 space-y-1">
            {navigation.map((item) => (
              <Link
                key={item.name}
                to={item.href}
                className={`block px-3 py-2 rounded-md text-base font-medium transition-colors font-kaspa-body ${
                  isActive(item.href)
                    ? 'bg-kaspa-primary-green/20 text-kaspa-secondary-green'
                    : 'text-kaspa-primary-gray hover:text-kaspa-secondary-green hover:bg-kaspa-primary-green/10'
                }`}
              >
                {item.name}
              </Link>
            ))}
          </div>
        </div>
      )}
    </header>
  );
};

export default Header;