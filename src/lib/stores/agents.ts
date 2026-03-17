import { writable } from 'svelte/store'

import { getAgents, type BridgeAgent } from '../api'

interface AgentsState {
  error: string | null
  items: BridgeAgent[]
  loading: boolean
}

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Unknown error'
}

function createAgentsStore() {
  const { subscribe, update } = writable<AgentsState>({
    error: null,
    items: [],
    loading: false,
  })

  return {
    async load() {
      update((state) => ({ ...state, error: null, loading: true }))

      try {
        const items = await getAgents()
        update(() => ({ error: null, items, loading: false }))
        return items
      } catch (error) {
        update((state) => ({
          ...state,
          error: toErrorMessage(error),
          loading: false,
        }))
        throw error
      }
    },
    subscribe,
  }
}

export type Agent = BridgeAgent
export const agents = createAgentsStore()
