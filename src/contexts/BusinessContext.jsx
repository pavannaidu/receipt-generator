import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { getAllBusinesses, getBusinessById, createBusiness, updateBusiness, deleteBusiness } from '../db';

const LAST_BUSINESS_KEY = 'lastBusinessId';

const BusinessContext = createContext(null);

export function BusinessProvider({ children }) {
  const [businesses, setBusinesses] = useState([]);
  const [currentBusiness, setCurrentBusinessState] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Load all businesses on mount
  const loadBusinesses = useCallback(async () => {
    try {
      setLoading(true);
      const allBusinesses = await getAllBusinesses();
      setBusinesses(allBusinesses);

      // Try to restore last selected business
      const lastBusinessId = localStorage.getItem(LAST_BUSINESS_KEY);
      if (lastBusinessId && allBusinesses.length > 0) {
        const lastBusiness = allBusinesses.find(b => b.id === parseInt(lastBusinessId));
        if (lastBusiness) {
          setCurrentBusinessState(lastBusiness);
        }
      }

      setError(null);
    } catch (e) {
      console.error('Error loading businesses:', e);
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadBusinesses();
  }, [loadBusinesses]);

  // Set current business and persist to localStorage
  const setCurrentBusiness = useCallback((business) => {
    setCurrentBusinessState(business);
    if (business) {
      localStorage.setItem(LAST_BUSINESS_KEY, business.id.toString());
    } else {
      localStorage.removeItem(LAST_BUSINESS_KEY);
    }
  }, []);

  // Create a new business
  const addBusiness = useCallback(async (businessData) => {
    try {
      const newId = await createBusiness(businessData);
      const newBusiness = await getBusinessById(newId);
      setBusinesses(prev => [...prev, newBusiness]);
      return newBusiness;
    } catch (e) {
      console.error('Error creating business:', e);
      throw e;
    }
  }, []);

  // Update existing business
  const editBusiness = useCallback(async (businessData) => {
    try {
      await updateBusiness(businessData);
      const updatedBusiness = await getBusinessById(businessData.id);
      setBusinesses(prev => prev.map(b => b.id === businessData.id ? updatedBusiness : b));

      // Update current business if it's the one being edited
      if (currentBusiness && currentBusiness.id === businessData.id) {
        setCurrentBusinessState(updatedBusiness);
      }

      return updatedBusiness;
    } catch (e) {
      console.error('Error updating business:', e);
      throw e;
    }
  }, [currentBusiness]);

  // Delete (soft delete) a business
  const removeBusiness = useCallback(async (businessId) => {
    try {
      await deleteBusiness(businessId);
      setBusinesses(prev => prev.filter(b => b.id !== businessId));

      // Clear current business if it's the one being deleted
      if (currentBusiness && currentBusiness.id === businessId) {
        setCurrentBusiness(null);
      }
    } catch (e) {
      console.error('Error deleting business:', e);
      throw e;
    }
  }, [currentBusiness, setCurrentBusiness]);

  // Clear business selection (go back to selector)
  const clearSelection = useCallback(() => {
    setCurrentBusiness(null);
  }, [setCurrentBusiness]);

  const value = {
    // State
    businesses,
    currentBusiness,
    loading,
    error,
    isBusinessSelected: !!currentBusiness,
    hasBusinesses: businesses.length > 0,

    // Actions
    setCurrentBusiness,
    addBusiness,
    editBusiness,
    removeBusiness,
    clearSelection,
    refreshBusinesses: loadBusinesses,
  };

  return (
    <BusinessContext.Provider value={value}>
      {children}
    </BusinessContext.Provider>
  );
}

export function useBusiness() {
  const context = useContext(BusinessContext);
  if (!context) {
    throw new Error('useBusiness must be used within a BusinessProvider');
  }
  return context;
}

export default BusinessContext;
