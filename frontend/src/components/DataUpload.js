import React, { useState, useRef } from 'react';
import axios from 'axios';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const DataUpload = () => {
  const [customerFile, setCustomerFile] = useState(null);
  const [loanFile, setLoanFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState(null);
  const customerFileRef = useRef(null);
  const loanFileRef = useRef(null);

  const handleFileChange = (e, type) => {
    const file = e.target.files[0];
    if (file && (file.name.endsWith('.xlsx') || file.name.endsWith('.xls'))) {
      if (type === 'customer') {
        setCustomerFile(file);
      } else {
        setLoanFile(file);
      }
    } else {
      alert('Please select a valid Excel file (.xlsx or .xls)');
      e.target.value = '';
    }
  };

  const handleUpload = async () => {
    if (!customerFile && !loanFile) {
      alert('Please select at least one file to upload');
      return;
    }

    setUploading(true);
    setUploadResult(null);

    try {
      const formData = new FormData();
      if (customerFile) {
        formData.append('customer_data', customerFile);
      }
      if (loanFile) {
        formData.append('loan_data', loanFile);
      }

      const response = await axios.post(`${API}/ingest-data`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      setUploadResult(response.data);
      setCustomerFile(null);
      setLoanFile(null);
      if (customerFileRef.current) customerFileRef.current.value = '';
      if (loanFileRef.current) loanFileRef.current.value = '';
    } catch (error) {
      console.error('Upload failed:', error);
      alert('Upload failed: ' + (error.response?.data?.detail || 'Unknown error'));
    } finally {
      setUploading(false);
    }
  };

  const removeFile = (type) => {
    if (type === 'customer') {
      setCustomerFile(null);
      if (customerFileRef.current) customerFileRef.current.value = '';
    } else {
      setLoanFile(null);
      if (loanFileRef.current) loanFileRef.current.value = '';
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="bg-white rounded-xl shadow-lg p-8">
        <h2 className="text-3xl font-bold text-gray-800 mb-8">Data Upload</h2>
        
        <div className="mb-8">
          <div className="bg-blue-50 border-l-4 border-blue-400 p-4 mb-6">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-blue-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-blue-800">
                  File Format Requirements
                </h3>
                <div className="mt-2 text-sm text-blue-700">
                  <p>Please ensure your Excel files contain the following columns:</p>
                  <ul className="list-disc list-inside mt-2 space-y-1">
                    <li><strong>Customer Data:</strong> customer_id, first_name, last_name, phone_number, monthly_salary, approved_limit, current_debt</li>
                    <li><strong>Loan Data:</strong> loan_id, customer_id, loan_amount, tenure, interest_rate, monthly_repayment, emis_paid_on_time, start_date, end_date, status</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
          {/* Customer Data Upload */}
          <div>
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Customer Data</h3>
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-blue-400 transition-colors duration-200">
              <input
                ref={customerFileRef}
                type="file"
                accept=".xlsx,.xls"
                onChange={(e) => handleFileChange(e, 'customer')}
                className="hidden"
                id="customer-file"
              />
              
              {!customerFile ? (
                <label htmlFor="customer-file" className="cursor-pointer">
                  <div className="mx-auto w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                    <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <p className="text-gray-600 mb-2">Click to upload customer data</p>
                  <p className="text-sm text-gray-400">Excel files (.xlsx, .xls) only</p>
                </label>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center justify-center space-x-2">
                    <svg className="w-8 h-8 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM6.293 6.707a1 1 0 010-1.414l3-3a1 1 0 011.414 0l3 3a1 1 0 01-1.414 1.414L11 5.414V13a1 1 0 11-2 0V5.414L7.707 6.707a1 1 0 01-1.414 0z" clipRule="evenodd" />
                    </svg>
                    <span className="text-green-700 font-medium">{customerFile.name}</span>
                  </div>
                  <button
                    onClick={() => removeFile('customer')}
                    className="text-red-600 hover:text-red-800 text-sm font-medium"
                  >
                    Remove file
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Loan Data Upload */}
          <div>
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Loan Data</h3>
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-blue-400 transition-colors duration-200">
              <input
                ref={loanFileRef}
                type="file"
                accept=".xlsx,.xls"
                onChange={(e) => handleFileChange(e, 'loan')}
                className="hidden"
                id="loan-file"
              />
              
              {!loanFile ? (
                <label htmlFor="loan-file" className="cursor-pointer">
                  <div className="mx-auto w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                    <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                    </svg>
                  </div>
                  <p className="text-gray-600 mb-2">Click to upload loan data</p>
                  <p className="text-sm text-gray-400">Excel files (.xlsx, .xls) only</p>
                </label>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center justify-center space-x-2">
                    <svg className="w-8 h-8 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM6.293 6.707a1 1 0 010-1.414l3-3a1 1 0 011.414 0l3 3a1 1 0 01-1.414 1.414L11 5.414V13a1 1 0 11-2 0V5.414L7.707 6.707a1 1 0 01-1.414 0z" clipRule="evenodd" />
                    </svg>
                    <span className="text-green-700 font-medium">{loanFile.name}</span>
                  </div>
                  <button
                    onClick={() => removeFile('loan')}
                    className="text-red-600 hover:text-red-800 text-sm font-medium"
                  >
                    Remove file
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Upload Button */}
        <div className="text-center">
          <button
            onClick={handleUpload}
            disabled={uploading || (!customerFile && !loanFile)}
            className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-medium py-3 px-8 rounded-lg transition-colors duration-200 inline-flex items-center space-x-2"
          >
            {uploading ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                <span>Uploading...</span>
              </>
            ) : (
              <>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
                <span>Upload Data</span>
              </>
            )}
          </button>
        </div>

        {/* Upload Result */}
        {uploadResult && (
          <div className="mt-8 bg-green-50 border border-green-200 rounded-lg p-6">
            <div className="flex items-center mb-4">
              <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                <svg className="w-5 h-5 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              </div>
              <h3 className="ml-3 text-lg font-semibold text-green-800">Upload Successful!</h3>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white rounded-lg p-4 border border-green-200">
                <p className="text-sm text-gray-600">Customers Processed</p>
                <p className="text-2xl font-bold text-green-700">{uploadResult.processed_customers}</p>
              </div>
              <div className="bg-white rounded-lg p-4 border border-green-200">
                <p className="text-sm text-gray-600">Loans Processed</p>
                <p className="text-2xl font-bold text-green-700">{uploadResult.processed_loans}</p>
              </div>
            </div>
            
            <p className="mt-4 text-sm text-green-700">{uploadResult.message}</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default DataUpload;