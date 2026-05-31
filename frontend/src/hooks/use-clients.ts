import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000';

export interface BackendClient {
  id: string;
  email: string;
  business_email?: string;
  company_name: string;
  agent_id: string;
  service_area: string;
  created_at: string;
}

export interface UpdateClientData {
  email?: string;
  company_name?: string;
  agent_id?: string;
  service_area?: string;
}

export interface UpdateClientProfileData {
  email?: string;
  company_name?: string;
  service_area?: string;
}

/**
 * Fetch all clients from the backend (admin)
 */
export function useBackendClients() {
  return useQuery<BackendClient[]>({
    queryKey: ['backend-clients'],
    queryFn: async () => {
      const response = await fetch(`${BACKEND_URL}/clients`);
      if (!response.ok) {
        throw new Error('Failed to fetch clients');
      }
      return response.json();
    },
  });
}

/**
 * Fetch a single client by ID from the backend (admin)
 */
export function useBackendClient(clientId: string | undefined) {
  return useQuery<BackendClient>({
    queryKey: ['backend-client', clientId],
    queryFn: async () => {
      if (!clientId) throw new Error('Client ID is required');
      const response = await fetch(`${BACKEND_URL}/clients`);
      if (!response.ok) {
        throw new Error('Failed to fetch clients');
      }
      const clients: BackendClient[] = await response.json();
      const client = clients.find(c => c.id === clientId);
      if (!client) {
        throw new Error('Client not found');
      }
      return client;
    },
    enabled: !!clientId,
  });
}

/**
 * Update a client by ID (admin)
 */
export function useUpdateClient() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: UpdateClientData }) => {
      const response = await fetch(`${BACKEND_URL}/clients/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Failed to update client');
      }
      
      return response.json();
    },
    onSuccess: () => {
      // Invalidate and refetch clients list
      queryClient.invalidateQueries({ queryKey: ['backend-clients'] });
    },
  });
}

/**
 * Update client's own profile (client self-service)
 */
export function useUpdateClientProfile() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ currentEmail, data }: { currentEmail: string; data: UpdateClientProfileData }) => {
      const response = await fetch(`${BACKEND_URL}/auth/client/profile?current_email=${encodeURIComponent(currentEmail)}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Failed to update profile');
      }
      
      return response.json();
    },
    onSuccess: () => {
      // Invalidate and refetch profile
      queryClient.invalidateQueries({ queryKey: ['client-profile'] });
    },
  });
}
