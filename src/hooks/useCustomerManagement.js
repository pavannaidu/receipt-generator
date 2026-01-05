import { useState, useCallback, useMemo } from 'react';
import * as db from '../db';

const STORAGE_KEY = 'receiptApp_customers';

/**
 * Custom hook for customer management
 * Handles customer CRUD and autocomplete
 */
export function useCustomerManagement({ isTauri, businessId }) {
  const [customers, setCustomers] = useState([]);
  const [customerSearch, setCustomerSearch] = useState('');
  const [showCustomerSuggestions, setShowCustomerSuggestions] = useState(false);

  // Load customers
  const loadCustomers = useCallback(async () => {
    if (isTauri) {
      try {
        await db.migrateCustomersTable();
        const data = await db.getAllCustomers(businessId);
        setCustomers(data.map(c => ({
          id: c.id,
          name: c.name,
          phone: c.phone || '',
          address: c.address || ''
        })));
      } catch (err) {
        console.error('Error loading customers:', err);
      }
    } else {
      try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
          setCustomers(JSON.parse(saved));
        }
      } catch (err) {
        console.error('Error loading customers from localStorage:', err);
      }
    }
  }, [isTauri, businessId]);

  // Save customers to localStorage (for browser mode)
  const saveCustomersToStorage = useCallback((updatedCustomers) => {
    if (!isTauri) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedCustomers));
    }
  }, [isTauri]);

  // Add new customer
  const addCustomer = useCallback(async (customer) => {
    const newCustomer = {
      id: Date.now(),
      name: customer.name.trim(),
      phone: customer.phone?.trim() || '',
      address: customer.address?.trim() || ''
    };

    if (!newCustomer.name) return false;

    // Check if customer with same name exists
    const exists = customers.some(c => c.name.toLowerCase() === newCustomer.name.toLowerCase());
    if (exists) return false;

    if (isTauri) {
      try {
        await db.addCustomer(newCustomer, businessId);
      } catch (err) {
        console.error('Error adding customer:', err);
        return false;
      }
    }

    const updated = [...customers, newCustomer].sort((a, b) => a.name.localeCompare(b.name));
    setCustomers(updated);
    saveCustomersToStorage(updated);
    return true;
  }, [customers, isTauri, businessId, saveCustomersToStorage]);

  // Update customer
  const updateCustomer = useCallback(async (customer) => {
    if (isTauri) {
      try {
        await db.updateCustomer(customer);
      } catch (err) {
        console.error('Error updating customer:', err);
        return false;
      }
    }

    const updated = customers.map(c => c.id === customer.id ? customer : c);
    setCustomers(updated);
    saveCustomersToStorage(updated);
    return true;
  }, [customers, isTauri, saveCustomersToStorage]);

  // Delete customer
  const deleteCustomer = useCallback(async (customerId) => {
    if (isTauri) {
      try {
        await db.deleteCustomer(customerId);
      } catch (err) {
        console.error('Error deleting customer:', err);
        return false;
      }
    }

    const updated = customers.filter(c => c.id !== customerId);
    setCustomers(updated);
    saveCustomersToStorage(updated);
    return true;
  }, [customers, isTauri, saveCustomersToStorage]);

  // Filtered customer suggestions
  const filteredCustomers = useMemo(() => {
    if (!customerSearch) return customers.slice(0, 8);
    const searchLower = customerSearch.toLowerCase();
    return customers
      .filter(c => c.name.toLowerCase().includes(searchLower))
      .slice(0, 8);
  }, [customers, customerSearch]);

  // Handle customer search
  const handleCustomerSearch = useCallback((searchText) => {
    setCustomerSearch(searchText);
    setShowCustomerSuggestions(searchText.length > 0 || customers.length > 0);
  }, [customers.length]);

  // Select customer from suggestions
  const selectCustomer = useCallback((customer) => {
    setCustomerSearch(customer.name);
    setShowCustomerSuggestions(false);
    return customer;
  }, []);

  // Get or create customer by name
  const getOrCreateCustomer = useCallback(async (name) => {
    const trimmedName = name.trim();
    if (!trimmedName) return null;

    // Check if customer exists
    const existing = customers.find(c => c.name.toLowerCase() === trimmedName.toLowerCase());
    if (existing) return existing;

    // Create new customer
    const newCustomer = { name: trimmedName, phone: '', address: '' };
    const success = await addCustomer(newCustomer);
    if (success) {
      return { ...newCustomer, id: Date.now() };
    }
    return null;
  }, [customers, addCustomer]);

  return {
    // State
    customers,
    customerSearch,
    setCustomerSearch,
    showCustomerSuggestions,
    setShowCustomerSuggestions,
    filteredCustomers,

    // Actions
    loadCustomers,
    addCustomer,
    updateCustomer,
    deleteCustomer,
    handleCustomerSearch,
    selectCustomer,
    getOrCreateCustomer
  };
}
