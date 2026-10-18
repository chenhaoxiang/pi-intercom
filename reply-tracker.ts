import { getAskTimeoutMs } from "./config.ts";
import type { Message, SessionInfo } from "./types.ts";

export interface IntercomContext {
  from: SessionInfo;
  message: Message;
  receivedAt: number;
}

export function matchesPendingSender(from: Pick<SessionInfo, "id" | "name">, to: string): boolean {
  if (from.id === to || from.id.startsWith(to)) {
    return true;
  }

  return from.name?.toLowerCase() === to.toLowerCase();
}

function hasPendingSenderMatch(pending: IntercomContext[], to: string): boolean {
  const lowerTo = to.toLowerCase();
  return pending.some((context) => context.from.id === to
    || context.from.name?.toLowerCase() === lowerTo
    || context.from.id.startsWith(to));
}

function resolvePendingSender(pending: IntercomContext[], to: string): IntercomContext {
  const exactIdMatches = pending.filter((context) => context.from.id === to);
  if (exactIdMatches.length === 1) {
    return exactIdMatches[0]!;
  }
  if (exactIdMatches.length > 1) {
    throw new Error(`Multiple pending asks from session ID "${to}" — specify \`replyTo\``);
  }

  const lowerTo = to.toLowerCase();
  const exactNameMatches = pending.filter((context) => context.from.name?.toLowerCase() === lowerTo);
  if (exactNameMatches.length === 1) {
    return exactNameMatches[0]!;
  }
  if (exactNameMatches.length > 1) {
    throw new Error(`Multiple pending asks match sender name "${to}" — specify a full session ID or \`replyTo\``);
  }

  const idPrefixMatches = pending.filter((context) => context.from.id.startsWith(to));
  if (idPrefixMatches.length === 1) {
    return idPrefixMatches[0]!;
  }
  if (idPrefixMatches.length > 1) {
    throw new Error(`Multiple pending asks match ID prefix "${to}" — use a longer session ID prefix or specify \`replyTo\``);
  }

  throw new Error(`No pending ask from "${to}"`);
}

export class ReplyTracker {
  private readonly pendingAsks = new Map<string, IntercomContext>();
  private readonly pendingTurnContexts: IntercomContext[] = [];
  private currentTurnContext: IntercomContext | null = null;
  private currentOrdinaryTurnContext: IntercomContext | null = null;

  constructor(private readonly askTimeoutMs = getAskTimeoutMs()) {}

  recordIncomingMessage(from: SessionInfo, message: Message, receivedAt = Date.now()): IntercomContext {
    const context = { from, message, receivedAt };
    if (message.expectsReply) {
      this.pendingAsks.set(message.id, context);
    }
    return context;
  }

  queueTurnContext(context: IntercomContext): void {
    this.pendingTurnContexts.push(context);
  }

  beginTurn(now = Date.now()): void {
    this.pruneExpired(now);
    // Every message queued since the last turn is visible to this one, and some of them
    // started no turn (inboundTrigger "never"/"replies"). The bare-reply target is the only
    // ask among them, or the newest message when none asks; several asks leave it to `to`.
    const delivered = this.pendingTurnContexts.splice(0);
    const asks = delivered.filter((context) => context.message.expectsReply);
    // Keep explicit ordinary-message responses available without using them as
    // the bare-reply target while a pending ask is visible in the same turn.
    this.currentOrdinaryTurnContext = delivered.filter((context) => !context.message.expectsReply).at(-1) ?? null;
    this.currentTurnContext = asks.length > 0
      ? (asks.length === 1 ? asks[0]! : null)
      : delivered.at(-1) ?? null;
  }

  endTurn(): void {
    this.currentTurnContext = null;
    this.currentOrdinaryTurnContext = null;
  }

  reset(): void {
    this.pendingAsks.clear();
    this.pendingTurnContexts.length = 0;
    this.currentTurnContext = null;
    this.currentOrdinaryTurnContext = null;
  }

  resolveReplyTarget(options: { to?: string; replyTo?: string }, now = Date.now()): IntercomContext {
    const currentContext = this.currentTurnContext;
    this.pruneExpired(now);

    if (options.replyTo) {
      const target = this.pendingAsks.get(options.replyTo);
      if (!target) {
        throw new Error(`No pending ask with message ID "${options.replyTo}"`);
      }
      if (options.to && !matchesPendingSender(target.from, options.to)) {
        throw new Error(`Pending ask "${options.replyTo}" is not from "${options.to}"`);
      }
      return target;
    }

    const pending = Array.from(this.pendingAsks.values());
    if (options.to) {
      try {
        return resolvePendingSender(pending, options.to);
      } catch (error) {
        // Ordinary inbound messages are turn contexts but not pending asks.
        // Permit an explicit response only when it addresses that exact
        // context; never fall back to an arbitrary destination.
        const ordinaryContext = this.currentOrdinaryTurnContext;
        if (!hasPendingSenderMatch(pending, options.to)
          && ordinaryContext
          && matchesPendingSender(ordinaryContext.from, options.to)) {
          return ordinaryContext;
        }
        throw error;
      }
    }

    if (pending.length > 1) {
      throw new Error("Multiple pending asks — specify `replyTo` or `to`");
    }
    if (pending.length === 1) {
      return pending[0]!;
    }

    if (currentContext?.message.expectsReply) {
      throw new Error(`Current ask "${currentContext.message.id}" is expired or no longer pending — specify a pending \`replyTo\``);
    }

    if (this.currentTurnContext) {
      return this.currentTurnContext;
    }

    throw new Error("No active intercom context to reply to");
  }

  findUniquePendingAskFrom(to: string, now = Date.now()): IntercomContext | null {
    const candidates = Array.from(this.pendingAsks.values()).filter((context) => {
      if (now - context.receivedAt > this.askTimeoutMs) {
        return false;
      }
      return context.from.id === to || context.from.name?.toLowerCase() === to.toLowerCase();
    });
    return candidates.length === 1 ? candidates[0]! : null;
  }

  findActiveReplyTargetMismatch(to: string, now = Date.now()): IntercomContext | null {
    this.pruneExpired(now);
    if (!this.currentTurnContext?.message.expectsReply) {
      return null;
    }
    return this.currentTurnContext.from.id === to ? null : this.currentTurnContext;
  }

  markReplied(replyTo: string): void {
    this.dismissPendingAsk(replyTo);
  }

  dismissPendingAsk(replyTo: string): void {
    this.pendingAsks.delete(replyTo);
    for (let index = this.pendingTurnContexts.length - 1; index >= 0; index -= 1) {
      if (this.pendingTurnContexts[index]?.message.id === replyTo) {
        this.pendingTurnContexts.splice(index, 1);
      }
    }
    if (this.currentTurnContext?.message.id === replyTo) {
      this.currentTurnContext = null;
    }
  }

  listPending(now = Date.now()): IntercomContext[] {
    this.pruneExpired(now);
    return Array.from(this.pendingAsks.values()).sort((a, b) => a.receivedAt - b.receivedAt);
  }

  private pruneExpired(now: number): void {
    for (const [messageId, context] of this.pendingAsks) {
      if (now - context.receivedAt > this.askTimeoutMs) {
        this.dismissPendingAsk(messageId);
      }
    }
  }
}
