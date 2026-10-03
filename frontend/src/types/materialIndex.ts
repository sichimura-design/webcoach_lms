/** 教材検索の索引作り直し（管理画面「Vectorデータ設定」）の進み具合 */
export interface MaterialIndexRebuildStatus {
  status: 'idle' | 'running' | 'succeeded' | 'failed';
  /** listing: 教材一覧の取得 / fetching: 教材ページの取得 / indexing: 索引の保存 */
  phase?: 'starting' | 'listing' | 'fetching' | 'indexing';
  total_pages?: number;
  fetched_pages?: number;
  started_at?: string;
  finished_at?: string;
  error?: string;
  result?: {
    success: boolean;
    message: string;
    files_processed: number;
    documents_added: number;
    faiss_total_vectors: number;
    errors?: string[] | null;
  };
}
