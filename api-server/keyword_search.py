"""
教材のキーワード検索（文字2-gram + BM25）

埋め込みモデル(sentence-transformers/torch)を使わずに、教材チャンクから質問に関係する
ものを探す。以前の埋め込み検索(all-MiniLM-L6-v2)は英語向けで日本語の関連度を
ほとんど判別できず(無関係な質問でも類似度0.45前後)、torchの読み込みでapi-serverの
メモリを数百MB使っていた。

- 日本語は単語区切りが無いため、文字の2-gramを語として扱う（形態素解析の辞書は不要）
- 並び順はBM25、関連度(0〜1)は「質問の内容語(2-gram)のうち、その教材に出てくるものの
  IDF重み付き割合」。ひらがなだけの2-gram(「して」「ださ」等の助詞・活用)は内容語から外す
- 関連度はretrieve_nodeの下限(RAG_MIN_SIMILARITY)と比べるため、distance=1-関連度 で返す
"""
import math
import re
import unicodedata
from collections import Counter
from typing import Any, Dict, List, Optional

_NON_WORD = re.compile(r"[^0-9a-z぀-ヿ一-鿿]+")
_HIRAGANA_ONLY = re.compile(r"^[぀-ゟ]+$")

# BM25のパラメータ（一般的な既定値）
_K1 = 1.2
_B = 0.75


def tokenize(text: str) -> List[str]:
    """NFKC正規化・小文字化したうえで、記号・空白で区切った各区間を文字2-gramにする"""
    tokens: List[str] = []
    for segment in _NON_WORD.sub(" ", unicodedata.normalize("NFKC", text or "").lower()).split():
        if len(segment) == 1:
            tokens.append(segment)
        else:
            tokens.extend(segment[i:i + 2] for i in range(len(segment) - 1))
    return tokens


def content_tokens(text: str) -> List[str]:
    """関連度の計算に使う内容語（ひらがなだけの2-gramを除く）。重複は除く"""
    return list(dict.fromkeys(t for t in tokenize(text) if not _HIRAGANA_ONLY.match(t)))


class KeywordIndex:
    """教材チャンクのキーワード索引（プロセス内メモリ）"""

    def __init__(self, documents: List[str], metadatas: Optional[List[Dict[str, Any]]] = None):
        self.documents = list(documents)
        self.metadatas = list(metadatas) if metadatas is not None else [{} for _ in self.documents]
        self._term_counts = [Counter(tokenize(doc)) for doc in self.documents]
        self._lengths = [sum(tc.values()) for tc in self._term_counts]
        self._avg_length = (sum(self._lengths) / len(self._lengths)) if self._lengths else 0.0
        self._df = Counter(term for tc in self._term_counts for term in tc)

    def __len__(self) -> int:
        return len(self.documents)

    def _idf(self, term: str) -> float:
        # 教材に一度も出てこない語ほど重い（関連度の分母に入り、関係の薄い質問の関連度を下げる）
        n = len(self.documents)
        return math.log((n + 1) / (self._df.get(term, 0) + 0.5))

    def _bm25(self, index: int, terms: List[str]) -> float:
        tc = self._term_counts[index]
        norm = _K1 * (1 - _B + _B * self._lengths[index] / (self._avg_length or 1))
        return sum(
            self._idf(t) * tc[t] * (_K1 + 1) / (tc[t] + norm)
            for t in terms
            if t in tc
        )

    def _coverage(self, index: int, terms: List[str], total_weight: float) -> float:
        tc = self._term_counts[index]
        return sum(self._idf(t) for t in terms if t in tc) / total_weight

    def search(
        self,
        query: str,
        n_results: int = 5,
        course_id: Optional[int] = None,
        module_name: Optional[str] = None,
    ) -> Dict[str, Any]:
        """VectorDBRetriever.searchと同じ形（documents/metadatas/distancesの二重リスト）で返す"""
        terms = content_tokens(query)
        total_weight = sum(self._idf(t) for t in terms)
        if not terms or total_weight <= 0:
            return {"documents": [[]], "metadatas": [[]], "distances": [[]]}

        scored = []
        for i, meta in enumerate(self.metadatas):
            if course_id is not None and meta.get("course_id") != course_id:
                continue
            if module_name is not None and meta.get("module_name") != module_name:
                continue
            coverage = self._coverage(i, terms, total_weight)
            if coverage <= 0:
                continue
            scored.append((self._bm25(i, terms), coverage, i))

        scored.sort(key=lambda s: (s[0], s[1]), reverse=True)
        top = scored[:n_results]
        return {
            "documents": [[self.documents[i] for _, _, i in top]],
            "metadatas": [[self.metadatas[i] for _, _, i in top]],
            "distances": [[1.0 - coverage for _, coverage, _ in top]],
        }
