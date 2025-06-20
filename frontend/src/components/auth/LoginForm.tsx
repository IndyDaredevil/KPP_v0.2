import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import Button from '../ui/Button';
import Input from '../ui/Input';
import { Card, CardHeader, CardContent, CardTitle, CardDescription } from '../ui/Card';

const LoginForm: React.FC = () => {
  const navigate = useNavigate();
  const { login, isLoginLoading, loginError } = useAuth();
  
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    login(formData, {
      onSuccess: () => {
        navigate('/dashboard');
      }
    });
  };

  const getErrorMessage = (error: any): string => {
    if (error?.response?.data?.message) {
      return error.response.data.message;
    }
    if (error?.message) {
      return error.message;
    }
    return 'Login failed. Please try again.';
  };

  return (
    <div className="min-h-screen flex items-center justify-center kaspa-gradient-dark py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <div className="w-20 h-20 kaspa-gradient rounded-xl flex items-center justify-center mx-auto mb-6 shadow-xl kaspa-glow">
            <span className="text-white font-bold text-2xl font-kaspa-header">K</span>
          </div>
          <h2 className="text-3xl font-bold text-white font-kaspa-header">Sign in to your account</h2>
          <p className="mt-2 text-sm text-kaspa-primary-gray font-kaspa-body">
            Or{' '}
            <Link
              to="/register"
              className="font-medium text-kaspa-secondary-green hover:text-kaspa-primary-green transition-colors"
            >
              create a new account
            </Link>
          </p>
        </div>

        <Card variant="kaspa" className="shadow-2xl">
          <CardHeader>
            <CardTitle className="kaspa-text-gradient">Welcome back</CardTitle>
            <CardDescription>
              Enter your credentials to access your NFT listings dashboard
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {loginError && (
                <div className="bg-red-500/10 border border-red-500/20 rounded-md p-4">
                  <div className="flex">
                    <div className="flex-shrink-0">
                      <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <div className="ml-3">
                      <h3 className="text-sm font-medium text-red-400 font-kaspa-header">
                        Login Failed
                      </h3>
                      <div className="mt-2 text-sm text-red-300 font-kaspa-body">
                        {getErrorMessage(loginError)}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <div className="space-y-4">
                <Input
                  label="Email address"
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  required
                  autoComplete="email"
                  placeholder="Enter your email"
                />

                <Input
                  label="Password"
                  type="password"
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  required
                  autoComplete="current-password"
                  placeholder="Enter your password"
                />
              </div>

              <Button
                type="submit"
                className="w-full"
                loading={isLoginLoading}
                disabled={!formData.email || !formData.password}
              >
                {isLoginLoading ? 'Signing in...' : 'Sign in'}
              </Button>
            </form>

            <div className="mt-6">
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-kaspa-primary-green/30" />
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-2 bg-kaspa-accent-medium-blue text-kaspa-primary-gray font-kaspa-body">Need help?</span>
                </div>
              </div>

              <div className="mt-6 text-center">
                <p className="text-sm text-kaspa-primary-gray font-kaspa-body">
                  Having trouble signing in? Contact your administrator for assistance.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="text-center">
          <Link
            to="/api-test"
            className="text-sm text-kaspa-primary-gray hover:text-kaspa-secondary-green transition-colors font-kaspa-body"
          >
            API Test Page
          </Link>
        </div>
      </div>
    </div>
  );
};

export default LoginForm;