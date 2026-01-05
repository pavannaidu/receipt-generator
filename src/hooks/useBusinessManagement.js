import { useState, useCallback } from 'react';
import { useBusiness } from '../contexts/BusinessContext';

/**
 * Hook for managing business CRUD operations with form state
 */
export function useBusinessManagement() {
  const {
    businesses,
    currentBusiness,
    addBusiness,
    editBusiness,
    removeBusiness,
    setCurrentBusiness,
    refreshBusinesses,
  } = useBusiness();

  const [isCreating, setIsCreating] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editingBusiness, setEditingBusiness] = useState(null);
  const [formError, setFormError] = useState(null);
  const [isSaving, setIsSaving] = useState(false);

  // Start creating a new business
  const startCreate = useCallback(() => {
    setIsCreating(true);
    setEditingBusiness(null);
    setFormError(null);
  }, []);

  // Start editing an existing business
  const startEdit = useCallback((business) => {
    setIsEditing(true);
    setEditingBusiness(business);
    setFormError(null);
  }, []);

  // Cancel create/edit
  const cancelForm = useCallback(() => {
    setIsCreating(false);
    setIsEditing(false);
    setEditingBusiness(null);
    setFormError(null);
  }, []);

  // Save business (create or update)
  const saveBusiness = useCallback(async (formData) => {
    setFormError(null);
    setIsSaving(true);

    try {
      // Validate
      if (!formData.name || formData.name.trim() === '') {
        throw new Error('Business name is required');
      }

      if (isEditing && editingBusiness) {
        // Update existing
        await editBusiness({
          ...editingBusiness,
          ...formData,
          name: formData.name.trim(),
        });
      } else {
        // Create new
        const newBusiness = await addBusiness({
          name: formData.name.trim(),
          address: formData.address || '',
          phone: formData.phone || '',
          gstin: formData.gstin || '',
        });

        // Automatically select the newly created business
        setCurrentBusiness(newBusiness);
      }

      cancelForm();
      return true;
    } catch (e) {
      setFormError(e.message);
      return false;
    } finally {
      setIsSaving(false);
    }
  }, [isEditing, editingBusiness, addBusiness, editBusiness, setCurrentBusiness, cancelForm]);

  // Delete a business
  const deleteBusiness = useCallback(async (businessId) => {
    try {
      await removeBusiness(businessId);
      return true;
    } catch (e) {
      setFormError(e.message);
      return false;
    }
  }, [removeBusiness]);

  // Switch to a different business
  const switchBusiness = useCallback((business) => {
    setCurrentBusiness(business);
  }, [setCurrentBusiness]);

  return {
    // Data
    businesses,
    currentBusiness,
    editingBusiness,

    // Form state
    isCreating,
    isEditing,
    isFormOpen: isCreating || isEditing,
    formError,
    isSaving,

    // Actions
    startCreate,
    startEdit,
    cancelForm,
    saveBusiness,
    deleteBusiness,
    switchBusiness,
    refreshBusinesses,
  };
}
