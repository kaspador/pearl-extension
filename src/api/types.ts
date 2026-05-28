// Shared types both backend adapters return.

export interface ExplorerStats {
  blockHeight:    number | null;
  networkHashPs:  number | null;
  difficulty:     number | null;
  recommendedFee: number | null;   // grains/vB
  mempoolMinFee:  number | null;
  mintedPct:      number | null;
}

export interface UtxoDto { txid: string; vout: number; value: string; blockHeight: number }

export interface ScanResult {
  address: string;
  used:    boolean;
  balance: string;
  utxos:   UtxoDto[];
}

export interface AddressTx {
  txid:        string;
  time:        number | null;
  blockHeight: number | null;
  confirmed:   boolean;
  received:    number;
  sent:        number;
  net:         number;
  direction:   'in' | 'out' | 'self';
}

export interface AddressData {
  address:   string;
  balance:   number;
  txTotal:   number;
  utxoCount: number;
  firstTime: number | null;
  lastTime:  number | null;
  page:      number;
  pageSize:  number;
  transactions: AddressTx[];
}

export interface TxVin  { isCoinbase: boolean; address: string | null; value: number | null }
export interface TxVout { n: number; address: string | null; value: number }

export interface TxDetail {
  txid:          string;
  blockHeight:   number | null;
  blockTime:     number | null;
  confirmations: number | null;
  fee:           number | null;
  isCoinbase:    boolean;
  vin:           TxVin[];
  vout:          TxVout[];
}

export interface PriceData {
  price:     number | null;
  change24h: number | null;
  volume24h: number | null;
}
