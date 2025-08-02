import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const LoanApplication = () => {
  const [step, setStep] = useState(1);
  const [customerId, setCustomerId] = useState('');
  const [customer, setCustomer] = useState(null);
  const [loanData, setLoanData] = useState({
    loan_amount: '',
    interest_rate: '',
    tenure: ''
  });
  const [eligibility, setEligibility] = useState(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleCustomerLookup = async (e) => {
    e.preventDefault();
    if (!customerId.trim()) return;
    
    setLoading(true);
    try {
      const response = await axios.get(`${API}/get-customer/${customerId}`);
      setCustomer(response.data);
      setStep(2);
    } catch (error) {
      alert('Customer not found. Please check the ID or register the customer first.');
    } finally {
      setLoading(false);
    }
  };

  const handleEligibilityCheck = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      const response = await axios.post(`${API}/check-eligibility`, {
        customer_id: customerId,
        loan_amount: parseFloat(loanData.loan_amount),
        interest_rate: parseFloat(loanData.interest_rate),
        tenure: parseInt(loanData.tenure)
      });
      
      setEligibility(response.data);
      setStep(3);
    } catch (error) {
      alert('Error checking eligibility. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleLoanCreation = async () => {
    setLoading(true);
    
    try {
      const response = await axios.post(`${API}/create-loan`, {
        customer_id: customerId,
        loan_amount: parseFloat(loanData.loan_amount),
        interest_rate: eligibility.corrected_interest_rate,
        tenure: parseInt(loanData.tenure)
      });
      
      alert('Loan approved and created successfully!');
      navigate('/');
    } catch (error) {
      alert('Loan creation failed: ' + (error.response?.data?.detail || 'Unknown error'));
    } finally {
      setLoading(false);
    }
  };

  const renderStep1 = () => (
    <div className="bg-white rounded-xl shadow-lg p-8">
      <h2 className="text-3xl font-bold text-gray-800 mb-8">Loan Application - Step 1</h2>
      
      <form onSubmit={handleCustomerLookup} className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Customer ID *
          </label>
          <input
            type="text"
            value={customerId}
            onChange={(e) => setCustomerId(e.target.value)}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="Enter customer ID"
            required
          />
          <p className="mt-2 text-sm text-gray-600">
            Don't have a customer ID? <button type="button" onClick={() => navigate('/customers/register')} className="text-blue-600 hover:text-blue-800 font-medium">Register a new customer</button>
          </p>
        </div>
        
        <button
          type="submit"
          disabled={loading}
          className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium py-3 px-6 rounded-lg transition-colors duration-200"
        >
          {loading ? 'Looking up...' : 'Find Customer'}
        </button>
      </form>
    </div>
  );

  const renderStep2 = () => (
    <div className="bg-white rounded-xl shadow-lg p-8">
      <h2 className="text-3xl font-bold text-gray-800 mb-8">Loan Application - Step 2</h2>
      
      {/* Customer Info */}
      <div className="bg-gray-50 rounded-lg p-6 mb-8">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">Customer Information</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-gray-600">Name</p>
            <p className="font-medium">{customer?.first_name} {customer?.last_name}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Monthly Salary</p>
            <p className="font-medium">₹{customer?.monthly_salary?.toLocaleString()}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Credit Score</p>
            <p className="font-medium">{customer?.credit_score}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Approved Limit</p>
            <p className="font-medium">₹{customer?.approved_limit?.toLocaleString()}</p>
          </div>
        </div>
      </div>
      
      {/* Loan Details Form */}
      <form onSubmit={handleEligibilityCheck} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Loan Amount *
            </label>
            <input
              type="number"
              value={loanData.loan_amount}
              onChange={(e) => setLoanData({...loanData, loan_amount: e.target.value})}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Enter amount"
              required
              min="1000"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Interest Rate (%) *
            </label>
            <input
              type="number"
              step="0.1"
              value={loanData.interest_rate}
              onChange={(e) => setLoanData({...loanData, interest_rate: e.target.value})}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Enter rate"
              required
              min="0.1"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Tenure (months) *
            </label>
            <input
              type="number"
              value={loanData.tenure}
              onChange={(e) => setLoanData({...loanData, tenure: e.target.value})}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Enter months"
              required
              min="1"
              max="360"
            />
          </div>
        </div>
        
        <div className="flex space-x-4">
          <button
            type="submit"
            disabled={loading}
            className="flex-1 bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white font-medium py-3 px-6 rounded-lg transition-colors duration-200"
          >
            {loading ? 'Checking...' : 'Check Eligibility'}
          </button>
          
          <button
            type="button"
            onClick={() => setStep(1)}
            className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 font-medium py-3 px-6 rounded-lg transition-colors duration-200"
          >
            Back
          </button>
        </div>
      </form>
    </div>
  );

  const renderStep3 = () => (
    <div className="bg-white rounded-xl shadow-lg p-8">
      <h2 className="text-3xl font-bold text-gray-800 mb-8">Loan Application - Step 3</h2>
      
      {/* Eligibility Result */}
      <div className={`rounded-lg p-6 mb-8 ${eligibility?.approval ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
        <div className="flex items-center mb-4">
          {eligibility?.approval ? (
            <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
              <svg className="w-6 h-6 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
            </div>
          ) : (
            <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
              <svg className="w-6 h-6 text-red-600" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </div>
          )}
          <div className="ml-4">
            <h3 className={`text-xl font-semibold ${eligibility?.approval ? 'text-green-800' : 'text-red-800'}`}>
              {eligibility?.approval ? 'Loan Approved!' : 'Loan Not Approved'}
            </h3>
            <p className={`${eligibility?.approval ? 'text-green-600' : 'text-red-600'}`}>
              {eligibility?.approval ? 'Congratulations! The loan application meets all criteria.' : 'The loan application does not meet eligibility criteria.'}
            </p>
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-gray-600">Credit Score</p>
            <p className="font-medium">{eligibility?.credit_score}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Approved Interest Rate</p>
            <p className="font-medium">{eligibility?.corrected_interest_rate}%</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Monthly EMI</p>
            <p className="font-medium">₹{eligibility?.monthly_installment?.toLocaleString()}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Tenure</p>
            <p className="font-medium">{eligibility?.tenure} months</p>
          </div>
        </div>
      </div>
      
      <div className="flex space-x-4">
        {eligibility?.approval && (
          <button
            onClick={handleLoanCreation}
            disabled={loading}
            className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium py-3 px-6 rounded-lg transition-colors duration-200"
          >
            {loading ? 'Creating Loan...' : 'Create Loan'}
          </button>
        )}
        
        <button
          onClick={() => setStep(2)}
          className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 font-medium py-3 px-6 rounded-lg transition-colors duration-200"
        >
          Back to Edit
        </button>
        
        <button
          onClick={() => navigate('/')}
          className="flex-1 bg-gray-600 hover:bg-gray-700 text-white font-medium py-3 px-6 rounded-lg transition-colors duration-200"
        >
          Go to Dashboard
        </button>
      </div>
    </div>
  );

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Progress Indicator */}
      <div className="mb-8">
        <div className="flex items-center justify-center space-x-4">
          {[1, 2, 3].map((stepNum) => (
            <div key={stepNum} className="flex items-center">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                step >= stepNum ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-600'
              }`}>
                {stepNum}
              </div>
              {stepNum < 3 && (
                <div className={`w-16 h-1 ${step > stepNum ? 'bg-blue-600' : 'bg-gray-200'}`} />
              )}
            </div>
          ))}
        </div>
        <div className="flex justify-center mt-4 space-x-8 text-sm">
          <span className={step >= 1 ? 'text-blue-600 font-medium' : 'text-gray-500'}>Find Customer</span>
          <span className={step >= 2 ? 'text-blue-600 font-medium' : 'text-gray-500'}>Loan Details</span>
          <span className={step >= 3 ? 'text-blue-600 font-medium' : 'text-gray-500'}>Approval</span>
        </div>
      </div>

      {step === 1 && renderStep1()}
      {step === 2 && renderStep2()}
      {step === 3 && renderStep3()}
    </div>
  );
};

export default LoanApplication;