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
    <header className="bg-white shadow-sm border-b border-kaspa-primary-green/20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <div className="flex items-center">
            <Link to="/dashboard" className="flex items-center space-x-2">
              <div className="w-8 h-8 kaspa-gradient rounded-lg flex items-center justify-center shadow-md">
                <span className="text-white font-bold text-sm font-kaspa-header">K</span>
              </div>
              <span className="text-xl font-bold text-kaspa-primary-dark font-kaspa-header">
                Kaspa<span className="kaspa-text-gradient">NFT</span>
              </span>
            </Link>
          </div>

          {/* Navigation */}
          {isAuthenticated && (
            <nav className="hidden md:flex space-x-8">
              {navigation.map((item) => (
                <Link
                  key={item.name}
                  to={item.href}
                  className={`px-3 py-2 rounded-md text-sm font-medium transition-colors font-kaspa-body ${
                    isActive(item.href)
                      ? 'bg-kaspa-secondary-green/10 text-kaspa-primary-green border-b-2 border-kaspa-primary-green'
                      : 'text-kaspa-primary-gray hover:text-kaspa-primary-green hover:bg-kaspa-secondary-green/5'
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
                  <span className="text-sm font-medium text-kaspa-primary-dark font-kaspa-body">{user.email}</span>
                  <span className="text-xs text-kaspa-primary-gray capitalize kaspa-badge">{user.role}</span>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleLogout}
                  className="text-kaspa-primary-gray hover:text-kaspa-primary-dark"
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
        <div className="md:hidden border-t border-kaspa-primary-green/20">
          <div className="px-2 pt-2 pb-3 space-y-1">
            {navigation.map((item) => (
              <Link
                key={item.name}
                to={item.href}
                className={`block px-3 py-2 rounded-md text-base font-medium transition-colors font-kaspa-body ${
                  isActive(item.href)
                    ? 'bg-kaspa-secondary-green/10 text-kaspa-primary-green'
                    : 'text-kaspa-primary-gray hover:text-kaspa-primary-green hover:bg-kaspa-secondary-green/5'
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