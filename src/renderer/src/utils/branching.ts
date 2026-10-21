import { ChatMessage } from '@shared/types';

export interface SiblingInfo {
  siblings: ChatMessage[];
  index: number;
  total: number;
}

export interface BranchTreeResult {
  activeMessages: ChatMessage[];
  siblingsMap: Map<string, SiblingInfo>;
  activeBranchMap: Record<string, string>;
}

/**
 * Normalizes messages by connecting legacy linear messages where parentId is undefined/null.
 */
export function normalizeMessageParents(messages: ChatMessage[]): ChatMessage[] {
  if (messages.length <= 1) return messages;

  const anyHasParent = messages.some((m) => m.parentId !== undefined && m.parentId !== null);
  if (anyHasParent) {
    return messages;
  }

  // Linear link for legacy messages: each message's parent is the preceding one
  return messages.map((m, idx) => ({
    ...m,
    parentId: idx === 0 ? null : messages[idx - 1].id,
  }));
}

/**
 * Builds the active linear thread and calculates sibling pagination info for every message.
 */
export function buildBranchTree(
  rawMessages: ChatMessage[],
  branchSelections: Record<string, string> = {}
): BranchTreeResult {
  const messages = normalizeMessageParents(rawMessages);
  const messageMap = new Map<string, ChatMessage>(messages.map((m) => [m.id, m]));
  const childrenMap = new Map<string, ChatMessage[]>();

  for (const m of messages) {
    const parentKey = m.parentId && messageMap.has(m.parentId) ? m.parentId : 'root';
    if (!childrenMap.has(parentKey)) {
      childrenMap.set(parentKey, []);
    }
    childrenMap.get(parentKey)!.push(m);
  }

  // Sort each children list by createdAt ascending
  for (const list of childrenMap.values()) {
    list.sort((a, b) => a.createdAt - b.createdAt);
  }

  // Calculate sibling info for each message
  const siblingsMap = new Map<string, SiblingInfo>();
  for (const [, children] of childrenMap.entries()) {
    // Group children by role (user siblings vs assistant siblings)
    const userChildren = children.filter((c) => c.role === 'user');
    const assistantChildren = children.filter((c) => c.role === 'assistant');

    for (const group of [userChildren, assistantChildren]) {
      if (group.length === 0) continue;
      group.forEach((msg, idx) => {
        siblingsMap.set(msg.id, {
          siblings: group,
          index: idx,
          total: group.length,
        });
      });
    }
  }

  // Traverse down from root to leaf following branchSelections
  const activeMessages: ChatMessage[] = [];
  const activeBranchMap: Record<string, string> = { ...branchSelections };
  let currentKey = 'root';
  const visited = new Set<string>();

  while (childrenMap.has(currentKey) && !visited.has(currentKey)) {
    visited.add(currentKey);
    const children = childrenMap.get(currentKey)!;
    if (children.length === 0) break;

    // Pick selected child or default to the latest child
    const selectedId = activeBranchMap[currentKey];
    let selected = children.find((c) => c.id === selectedId);
    if (!selected) {
      selected = children[children.length - 1];
      activeBranchMap[currentKey] = selected.id;
    }

    activeMessages.push(selected);
    currentKey = selected.id;
  }

  return {
    activeMessages,
    siblingsMap,
    activeBranchMap,
  };
}

/**
 * Returns ancestor messages for a given target message (from root to target).
 */
export function getAncestorChain(messages: ChatMessage[], targetId: string): ChatMessage[] {
  const messageMap = new Map<string, ChatMessage>(messages.map((m) => [m.id, m]));
  const chain: ChatMessage[] = [];
  let currId: string | null = targetId;
  const visited = new Set<string>();

  while (currId && messageMap.has(currId) && !visited.has(currId)) {
    visited.add(currId);
    const msg: ChatMessage = messageMap.get(currId)!;
    chain.push(msg);
    currId = msg.parentId || null;
  }

  return chain.reverse();
}
