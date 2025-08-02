import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import axios from 'axios';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const CustomerProfile = () => {
  const { customerId } = useParams();
  const [customer, setCustomer] = useState(null);
  const [loans, setLoans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [paymentModal, setPaymentModal] = useState({ show: false, loanId: '', amount: '' });

  useEffect(() => {
    fetchCustomerData();
  }, [customerId]);

  const fetchCustomerData = async () => {
    try {
      const [customerResponse, loansResponse] = await Promise.all([
        axios.get(`${API}/get-customer/${customerId}`),
        axios.get(`${API}/view-loans/${customerId}`)
      ]);
      
      setCustomer(customerResponse.data);
      setLoans(loansResponse.data);
    } catch (error) {
      console.error('Error fetching customer data:', error);
      alert('Customer not found or error loading data');
    } finally {
      setLoading(false);
    }
  };

  const handlePayment = async () => {
    try {
      await axios.post(`${API}/make-payment/${paymentModal.loanId}`, {
        payment_amount: parseFloat(paymentModal.amount)
      });
      
      alert('Payment recorded successfully!');
      setPaymentModal({ show: false, loanId: '', amount: '' });
      fetchCustomerData(); // Refresh data
    } catch (error) {
      alert('Payment failed: ' + (error.response?.data?.detail || 'Unknown error'));
    }
  };

  const getCreditScoreColor = (score) => {
    if (score >= 750) return 'text-green-600 bg-green-100';
    if (score >= 650) return 'text-blue-600 bg-blue-100';
    if (score >= 550) return 'text-yellow-600 bg-yellow-100';
    return 'text-red-600 bg-red-100';
  };

  const getCreditScoreLabel = (score) => {
    if (score >= 750) return 'Excellent';
    if (score >= 650) return 'Good';
    if (score >= 550) return 'Fair';
    return 'Poor';
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-xl p-8 text-center">
          <h2 className="text-2xl font-bold text-red-800 mb-2">Customer Not Found</h2>
          <p className="text-red-600 mb-4">The customer ID you're looking for doesn't exist.</p>
          <Link to="/" className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg">
            Back to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Customer Info Header */}
      <div className="bg-white rounded-xl shadow-lg p-8 mb-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-800">
              {customer.first_name} {customer.last_name}
            </h1>
            <p className="text-gray-600">Customer ID: {customer.customer_id}</p>
          </div>
          <div className={`px-4 py-2 rounded-full ${getCreditScoreColor(customer.credit_score)}`}>
            <span className="font-semibold">{customer.credit_score} - {getCreditScoreLabel(customer.credit_score)}</span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-blue-50 rounded-lg p-4">
            <p className="text-sm text-blue-600 font-medium">Monthly Salary</p>
            <p className="text-2xl font-bold text-blue-800">₹{customer.monthly_salary?.toLocaleString()}</p>
          </div>
          
          <div className="bg-green-50 rounded-lg p-4">
            <p className="text-sm text-green-600 font-medium">Approved Limit</p>
            <p className="text-2xl font-bold text-green-800">₹{customer.approved_limit?.toLocaleString()}</p>
          </div>
          
          <div className="bg-orange-50 rounded-lg p-4">
            <p className="text-sm text-orange-600 font-medium">Current Debt</p>
            <p className="text-2xl font-bold text-orange-800">₹{customer.current_debt?.toLocaleString()}</p>
          </div>
          
          <div className="bg-purple-50 rounded-lg p-4">
            <p className="text-sm text-purple-600 font-medium">Active Loans</p>
            <p className="text-2xl font-bold text-purple-800">{customer.active_loans}</p>
          </div>
        </div>

        <div className="mt-6 flex space-x-4">
          <Link
            to="/loans/apply"
            state={{ customerId: customer.customer_id }}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors duration-200"
          >
            Apply for New Loan
          </Link>
          <Link
            to="/"
            className="bg-gray-200 hover:bg-gray-300 text-gray-800 px-4 py-2 rounded-lg font-medium transition-colors duration-200"
          >
            Back to Dashboard
          </Link>
        </div>
      </div>

      {/* Loans Section */}
      <div className="bg-white rounded-xl shadow-lg p-8">
        <h2 className="text-2xl font-bold text-gray-800 mb-6">Loan History</h2>
        
        {loans.length === 0 ? (
          <div className="text-center py-12">
            <svg className="w-16 h-16 mx-auto text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <p className="text-gray-600 text-lg">No loans found for this customer</p>
            <Link
              to="/loans/apply"
              state={{ customerId: customer.customer_id }}
              className="mt-4 inline-block bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium transition-colors duration-200"
            >
              Apply for First Loan
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full table-auto">
              <thead>
                <tr className="bg-gray-50">
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Loan ID</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Amount</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Interest Rate</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Monthly EMI</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Remaining</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Status</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {loans.map((loan) => (
                  <tr key={loan.loan_id} className="hover:bg-gray-50">
                    <td className="px-4 py-4 text-sm font-mono text-gray-600">
                      {loan.loan_id.substring(0, 8)}...
                    </td>
                    <td className="px-4 py-4 text-sm text-gray-900">
                      ₹{loan.loan_amount?.toLocaleString()}
                    </td>
                    <td className="px-4 py-4 text-sm text-gray-900">
                      {loan.interest_rate}%
                    </td>
                    <td className="px-4 py-4 text-sm text-gray-900">
                      ₹{loan.monthly_installment?.toLocaleString()}
                    </td>
                    <td className="px-4 py-4 text-sm text-gray-900">
                      {loan.repayments_left} months
                    </td>
                    <td className="px-4 py-4 text-sm">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        loan.status === 'active' 
                          ? 'bg-green-100 text-green-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}>
                        {loan.status}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-sm">
                      <button
                        onClick={() => setPaymentModal({
                          show: true,
                          loanId: loan.loan_id,
                          amount: loan.monthly_installment.toString()
                        })}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded text-xs font-medium transition-colors duration-200"
                      >
                        Make Payment
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Payment Modal */}
      {paymentModal.show && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md">
            <h3 className="text-xl font-bold text-gray-800 mb-4">Make Payment</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Payment Amount
                </label>
                <input
                  type="number"
                  value={paymentModal.amount}
                  onChange={(e) => setPaymentModal({...paymentModal, amount: e.target.value})}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Enter payment amount"
                  min="0"
                  step="0.01"
                />
              </div>
              
              <div className="flex space-x-3">
                <button
                  onClick={handlePayment}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-lg font-medium transition-colors duration-200"
                >
                  Record Payment
                </button>
                <button
                  onClick={() => setPaymentModal({ show: false, loanId: '', amount: '' })}
                  className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 py-2 px-4 rounded-lg font-medium transition-colors duration-200"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CustomerProfile;