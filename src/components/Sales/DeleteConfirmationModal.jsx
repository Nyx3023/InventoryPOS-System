import { XMarkIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';

const DeleteConfirmationModal = ({ transaction, onConfirm, onCancel }) => {
  if (!transaction) return null;

  const formatCurrency = (amount) => {
    return `₱${(parseFloat(amount) || 0).toFixed(2)}`;
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString();
  };

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
        <div className="flex items-center mb-4">
          <div className="flex-shrink-0">
            <ExclamationTriangleIcon className="h-8 w-8 text-red-600" />
          </div>
          <div className="ml-3">
            <h3 className="text-lg font-medium text-gray-900">
              Delete Transaction
            </h3>
            <p className="text-sm text-gray-500">
              This action cannot be undone
            </p>
          </div>
          <button
            onClick={onCancel}
            className="ml-auto text-gray-400 hover:text-gray-600"
          >
            <XMarkIcon className="h-6 w-6" />
          </button>
        </div>

        <div className="bg-gray-50 rounded-lg p-4 mb-6">
          <h4 className="font-medium text-gray-900 mb-2">Transaction Details</h4>
          <div className="space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">ID:</span>
              <span className="font-mono text-gray-900">{transaction.id}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Date:</span>
              <span className="text-gray-900">{formatDate(transaction.timestamp)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Amount:</span>
              <span className="font-medium text-gray-900">{formatCurrency(transaction.total)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Items:</span>
              <span className="text-gray-900">{transaction.items?.length || 0} items</span>
            </div>
          </div>
        </div>

        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
          <div className="flex">
            <ExclamationTriangleIcon className="h-5 w-5 text-red-600 mt-0.5" />
            <div className="ml-3">
              <h4 className="text-sm font-medium text-red-800">Warning</h4>
              <div className="text-sm text-red-700 mt-1">
                <ul className="list-disc pl-4 space-y-1">
                  <li>This transaction will be permanently deleted</li>
                  <li>Associated sales data will be removed from reports</li>
                  <li>This action cannot be undone</li>
                  <li>Only administrators can perform this action</li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        <div className="flex space-x-3">
          <button
            onClick={onCancel}
            className="flex-1 px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 px-4 py-2 border border-transparent rounded-md text-sm font-medium text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
          >
            Delete Transaction
          </button>
        </div>
      </div>
    </div>
  );
};

export default DeleteConfirmationModal; 