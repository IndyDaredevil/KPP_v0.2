import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import Button from '../ui/Button';
import Input from '../ui/Input';
import { Card, CardHeader, CardContent, CardTitle, CardDescription } from '../ui/Card';

const RegisterForm: React.FC = () => {
  const navigate = useNavigate();
  const { register, isRegisterLoading, registerError } = useAuth();
  
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
  });

  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));

    // Clear validation error when user starts typing
    if (validationErrors[name]) {
      setValidationErrors(prev => ({
        ...prev,
        [name]: ''
      }));
    }
  };

  const validateForm = () => {
    const errors: Record<string, string> = {};

    if (!formData.email) {
      errors.email = 'Email is required';
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      errors.email = 'Please enter a valid email address';
    }

    if (!formData.password) {
      errors.password = 'Password is required';
    } else if (formData.password.length < 8) {
      errors.password = 'Password must be at least 8 characters long';
    } else if (!/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/.test(formData.password)) {
      errors.password = 'Password must contain uppercase, lowercase, number and special character';
    }

    if (!formData.confirmPassword) {
      errors.confirmPassword = 'Please confirm your password';
    } else if (formData.password !== formData.confirmPassword) {
      errors.confirmPassword = 'Passwords do not match';
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    register({
      email: formData.email,
      password: formData.password
    }, {
      onSuccess: () => {
        // Registration successful, redirect to login
        navigate('/login', {
          state: {
            message: 'Registration successful! Please sign in with your credentials.'
          }
        });
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
    return 'Registration failed. Please try again.';
  };

  const isFormValid = formData.email && formData.password && formData.confirmPassword && 
                     Object.keys(validationErrors).length === 0;

  return (
    <div className="min-h-screen flex items-center justify-center kaspa-gradient-dark py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <div className="w-20 h-20 kaspa-gradient rounded-xl flex items-center justify-center mx-auto mb-6 shadow-xl kaspa-glow">
            <span className="text-white font-bold text-2xl font-kaspa-header">K</span>
          </div>
          <h2 className="text-3xl font-bold text-white font-kaspa-header">Create your account</h2>
          <p className="mt-2 text-sm text-kaspa-primary-gray font-kaspa-body">
            Or{' '}
            <Link
              to="/login"
              className="font-medium text-kaspa-secondary-green hover:text-kaspa-primary-green transition-colors"
            >
              sign in to your existing account
            </Link>
          </p>
        </div>

        <Card variant="kaspa" className="shadow-2xl">
          <CardHeader>
            <CardTitle className="kaspa-text-gradient">Get started</CardTitle>
            <CardDescription>
              Create your account to start managing NFT listings
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {registerError && (
                <div className="bg-red-500/10 border border-red-500/20 rounded-md p-4">
                  <div className="flex">
                    <div className="flex-shrink-0">
                      <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <div className="ml-3">
                      <h3 className="text-sm font-medium text-red-400 font-kaspa-header">
                        Registration Failed
                      </h3>
                      <div className="mt-2 text-sm text-red-300 font-kaspa-body">
                        {getErrorMessage(registerError)}
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
                  error={validationErrors.email}
                />

                <Input
                  label="Password"
                  type="password"
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  required
                  autoComplete="new-password"
                  placeholder="Create a password"
                  error={validationErrors.password}
                  helperText="Must be at least 8 characters with uppercase, lowercase, number and special character"
                />

                <Input
                  label="Confirm Password"
                  type="password"
                  name="confirmPassword"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  required
                  autoComplete="new-password"
                  placeholder="Confirm your password"
                  error={validationErrors.confirmPassword}
                />
              </div>

              <Button
                type="submit"
                className="w-full"
                loading={isRegisterLoading}
                disabled={!isFormValid}
              >
                {isRegisterLoading ? 'Creating account...' : 'Create account'}
              </Button>
            </form>

            <div className="mt-6">
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-kaspa-primary-green/30" />
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-2 bg-kaspa-accent-medium-blue text-kaspa-primary-gray font-kaspa-body">Terms</span>
                </div>
              </div>

              <div className="mt-6 text-center">
                <p className="text-xs text-kaspa-primary-gray font-kaspa-body">
                  By creating an account, you agree to our terms of service and privacy policy.
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

export default RegisterForm;