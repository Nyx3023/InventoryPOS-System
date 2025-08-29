import { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import { useTheme } from '../../context/ThemeContext';
import { 
  PlusIcon, 
  PencilIcon, 
  TrashIcon,
  EyeIcon,
  EyeSlashIcon
} from '@heroicons/react/24/outline';
import AdminOnly from './AdminOnly';
import { db } from '../../config/firebase';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore';

const UserManagement = () => {
  const { colors } = useTheme();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    role: ''
  });
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const snap = await getDocs(collection(db, 'users'));
      const list = snap.docs.map(d => {
        const data = d.data() || {};
        const created = data.createdAt && data.createdAt.toDate ? data.createdAt.toDate() : (data.createdAt ? new Date(data.createdAt) : null);
        return {
          id: d.id,
          name: data.name || '',
          email: data.email || '',
          role: data.role || 'employee',
          created_at: created || new Date(0)
        };
      });
      setUsers(list);
    } catch (error) {
      console.error('Error fetching users:', error);
      toast.error('Error fetching users');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    console.log(`Input changed: ${name} = ${value}`);
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Debug logging
    console.log('Form data before submission:', formData);
    
    // Validate role selection
    if (!formData.role) {
      toast.error('Please select a role');
      return;
    }
    
    try {
      if (editingUser) {
        await updateDoc(doc(db, 'users', editingUser.id), {
          name: formData.name,
          email: formData.email,
          role: formData.role,
          updatedAt: new Date()
        });
      } else {
        await addDoc(collection(db, 'users'), {
          name: formData.name,
          email: formData.email,
          role: formData.role,
          createdAt: new Date(),
          updatedAt: new Date()
        });
      }
      toast.success(editingUser ? 'User updated successfully' : 'User created successfully');
      setShowModal(false);
      setEditingUser(null);
      setFormData({ name: '', email: '', password: '', role: '' });
      fetchUsers();
    } catch (error) {
      console.error('Error saving user:', error);
      toast.error('Error saving user');
    }
  };

  const handleEdit = (user) => {
    setEditingUser(user);
    setFormData({
      name: user.name,
      email: user.email,
      password: '',
      role: user.role
    });
    setShowModal(true);
  };

  const handleDelete = async (userId) => {
    if (!confirm('Are you sure you want to delete this user?')) {
      return;
    }

    try {
      await deleteDoc(doc(db, 'users', userId));
      toast.success('User deleted successfully');
      fetchUsers();
    } catch (error) {
      console.error('Error deleting user:', error);
      toast.error('Error deleting user');
    }
  };

  const openCreateModal = () => {
    setEditingUser(null);
    setFormData({ name: '', email: '', password: '', role: '' });
    setShowModal(true);
  };

  if (loading) {
    return (
      <AdminOnly>
        <div className="flex justify-center items-center h-64">
          <div className={`text-lg ${colors.text.primary}`}>Loading users...</div>
        </div>
      </AdminOnly>
    );
  }

  return (
    <AdminOnly>
      <div className={`${colors.card.primary} rounded-lg shadow border ${colors.border.primary} p-6`}>
        <div className="flex justify-between items-center mb-6">
          <h2 className={`text-lg font-semibold ${colors.text.primary}`}>User Management</h2>
          <button
            onClick={openCreateModal}
            className="bg-teal-600 hover:bg-teal-700 dark:bg-teal-500 dark:hover:bg-teal-600 text-white px-4 py-2 rounded-md flex items-center space-x-2 transition-colors"
          >
            <PlusIcon className="h-5 w-5" />
            <span>Add User</span>
          </button>
        </div>

        {/* Users Table */}
        <div className="overflow-x-auto">
          <table className={`min-w-full divide-y ${colors.border.primary}`}>
            <thead className={`${colors.bg.secondary}`}>
              <tr>
                <th className={`px-6 py-3 text-left text-xs font-medium ${colors.text.secondary} uppercase tracking-wider`}>
                  Name
                </th>
                <th className={`px-6 py-3 text-left text-xs font-medium ${colors.text.secondary} uppercase tracking-wider`}>
                  Email
                </th>
                <th className={`px-6 py-3 text-left text-xs font-medium ${colors.text.secondary} uppercase tracking-wider`}>
                  Role
                </th>
                <th className={`px-6 py-3 text-left text-xs font-medium ${colors.text.secondary} uppercase tracking-wider`}>
                  Created At
                </th>
                <th className={`px-6 py-3 text-left text-xs font-medium ${colors.text.secondary} uppercase tracking-wider`}>
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className={`${colors.card.primary} divide-y ${colors.border.primary}`}>
              {users.map((user) => (
                <tr key={user.id} className={`hover:${colors.bg.secondary}`}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className={`text-sm font-medium ${colors.text.primary}`}>{user.name}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className={`text-sm ${colors.text.primary}`}>{user.email}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                      user.role === 'admin' 
                        ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300' 
                        : 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300'
                    }`}>
                      {user.role}
                    </span>
                  </td>
                  <td className={`px-6 py-4 whitespace-nowrap text-sm ${colors.text.secondary}`}>
                    {new Date(user.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                    <button
                      onClick={() => handleEdit(user)}
                      className="text-teal-600 dark:text-teal-400 hover:text-teal-900 dark:hover:text-teal-300 p-1"
                      title="Edit User"
                    >
                      <PencilIcon className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(user.id)}
                      className="text-red-600 dark:text-red-400 hover:text-red-900 dark:hover:text-red-300 p-1"
                      title="Delete User"
                    >
                      <TrashIcon className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {users.length === 0 && (
            <div className={`text-center py-8 ${colors.text.secondary}`}>
              No users found
            </div>
          )}
        </div>

        {/* User Modal */}
        {showModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onKeyDown={(e)=>{ if(e.key==='Escape'){ e.stopPropagation(); setShowModal(false);} if(e.key==='Enter'){ e.stopPropagation(); /* treat enter as submit */ const form = e.currentTarget.querySelector('form'); if(form){ const btn = form.querySelector('button[type="submit"]'); if(btn){ btn.click(); } } } }}>
            <div className={`${colors.card.primary} rounded-lg p-6 w-full max-w-md border ${colors.border.primary}`}>
              <div className="flex justify-between items-center mb-4">
                <h3 className={`text-lg font-semibold ${colors.text.primary}`}>
                  {editingUser ? 'Edit User' : 'Create New User'}
                </h3>
                <button
                  onClick={() => setShowModal(false)}
                  className={`${colors.text.tertiary} hover:${colors.text.secondary}`}
                >
                  ×
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className={`block text-sm font-medium mb-1 ${colors.text.primary}`}>
                    Name
                  </label>
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleInputChange}
                    required
                    className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent ${colors.input.primary}`}
                  />
                </div>

                <div>
                  <label className={`block text-sm font-medium mb-1 ${colors.text.primary}`}>
                    Email
                  </label>
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleInputChange}
                    required
                    className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent ${colors.input.primary}`}
                  />
                </div>

                <div>
                  <label className={`block text-sm font-medium mb-1 ${colors.text.primary}`}>
                    Password (managed in Firebase Auth; not editable here)
                  </label>
                  <input
                    type="password"
                    name="password"
                    value={formData.password}
                    onChange={handleInputChange}
                    disabled
                    className={`w-full px-3 py-2 border rounded-md ${colors.input.primary} opacity-60`}
                    placeholder="Use Firebase Console to set/reset passwords"
                  />
                </div>

                <div>
                  <label className={`block text-sm font-medium mb-1 ${colors.text.primary}`}>
                    Role
                  </label>
                  <select
                    name="role"
                    value={formData.role}
                    onChange={handleInputChange}
                    required
                    className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent ${colors.input.primary}`}
                  >
                    <option value="">Select a role</option>
                    <option value="employee">Employee</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>

                <div className="flex space-x-3 pt-4">
                  <button
                    type="submit"
                    className="flex-1 bg-teal-600 hover:bg-teal-700 text-white py-2 px-4 rounded-md transition-colors"
                  >
                    {editingUser ? 'Update User' : 'Create User'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-700 py-2 px-4 rounded-md transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </AdminOnly>
  );
};

export default UserManagement; 