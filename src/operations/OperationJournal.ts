import type { OperationRecord, OperationType, TransactionRecord } from '../types';

export class OperationJournal {
	private readonly records: OperationRecord[] = [];
	private readonly transactions: TransactionRecord[] = [];

	record(type: OperationType, description: string, canvasPath?: string): OperationRecord {
		const record: OperationRecord = { id: crypto.randomUUID(), timestamp: Date.now(), type, description };
		if (canvasPath) record.canvasPath = canvasPath;
		this.records.push(record);
		return record;
	}
	recordTransaction(transaction: TransactionRecord): void { this.transactions.push(transaction); }
	getRecent(limit = 20): OperationRecord[] { return [...this.records].slice(-Math.max(0, limit)).reverse(); }
	getRecentTransactions(limit = 20): TransactionRecord[] { return [...this.transactions].slice(-Math.max(0, limit)).reverse(); }
	clear(): void { this.records.length = 0; this.transactions.length = 0; }
}
