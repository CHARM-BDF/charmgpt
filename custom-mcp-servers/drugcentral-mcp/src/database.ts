import pg from 'pg';
const { Pool } = pg;

export interface DrugInfo {
  id: number;
  name: string;
  cas_reg_no?: string;
  synonyms: string[];
  smiles?: string;
  inchi?: string;
  molecular_weight?: number;
  formula?: string;
}

export interface TargetInfo {
  id: number;
  name: string;
  uniprot?: string;
  gene?: string;
  organism?: string;
  target_class: string;
}

export interface MechanismOfAction {
  drug_id: number;
  drug_name: string;
  target_id: number;
  target_name: string;
  target_gene?: string;
  uniprot?: string;
  moa_type: string;
  evidence_source: string;
}

export interface BioactivityData {
  drug_id: number;
  drug_name: string;
  target_id: number;
  target_name: string;
  target_gene?: string;
  activity_type: string;
  activity_value?: number;
  activity_unit?: string;
  source: string;
  relation?: string;
  organism?: string;
}

export class DrugCentralDatabase {
  private pool: pg.Pool;

  constructor() {
    // DrugCentral provides a public database instance
    this.pool = new Pool({
      host: process.env.DRUGCENTRAL_HOST || 'unmtid-dbs.net',
      port: parseInt(process.env.DRUGCENTRAL_PORT || '5433'),
      database: process.env.DRUGCENTRAL_DB || 'drugcentral',
      user: process.env.DRUGCENTRAL_USER || 'drugman',
      password: process.env.DRUGCENTRAL_PASSWORD || 'dosage',
      ssl: false,
      max: 5,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
    });
  }

  async testConnection(): Promise<boolean> {
    try {
      const client = await this.pool.connect();
      const result = await client.query('SELECT 1 as test');
      client.release();
      return result.rows.length > 0;
    } catch (error) {
      console.error('Database connection test failed:', error);
      return false;
    }
  }

  async searchDrugs(query: string, limit: number = 10): Promise<DrugInfo[]> {
    const client = await this.pool.connect();
    try {
      const sql = `
        SELECT DISTINCT 
          s.id,
          s.name,
          s.cas_reg_no,
          s.smiles,
          s.inchi,
          s.cd_molweight,
          s.cd_formula
        FROM structures s
        LEFT JOIN synonyms syn ON s.id = syn.id
        WHERE 
          s.name ILIKE $1 
          OR s.cas_reg_no ILIKE $1 
          OR syn.synonym ILIKE $1
        ORDER BY 
          CASE 
            WHEN s.name ILIKE $1 THEN 1
            WHEN s.cas_reg_no ILIKE $1 THEN 2
            ELSE 3
          END,
          s.name
        LIMIT $2
      `;
      
      const result = await client.query(sql, [`%${query}%`, limit]);
      
      // Get synonyms for each drug
      const drugs: DrugInfo[] = [];
      for (const row of result.rows) {
        const synResult = await client.query(
          'SELECT synonym FROM synonyms WHERE id = $1',
          [row.id]
        );
        
        drugs.push({
          id: row.id,
          name: row.name,
          cas_reg_no: row.cas_reg_no,
          synonyms: synResult.rows.map(s => s.synonym),
          smiles: row.smiles,
          inchi: row.inchi,
          molecular_weight: row.cd_molweight,
          formula: row.cd_formula
        });
      }
      
      return drugs;
    } finally {
      client.release();
    }
  }

  async searchTargets(query: string, limit: number = 10): Promise<TargetInfo[]> {
    const client = await this.pool.connect();
    try {
      const sql = `
        SELECT DISTINCT
          td.id,
          td.name,
          td.target_class,
          atf.gene,
          atf.organism,
          atf.accession as uniprot
        FROM target_dictionary td
        LEFT JOIN act_table_full atf ON td.id = atf.target_id
        WHERE 
          td.name ILIKE $1 
          OR atf.gene ILIKE $1
          OR atf.accession ILIKE $1
        ORDER BY 
          CASE 
            WHEN atf.gene ILIKE $1 THEN 1
            WHEN td.name ILIKE $1 THEN 2
            ELSE 3
          END,
          td.name
        LIMIT $2
      `;
      
      const result = await client.query(sql, [`%${query}%`, limit]);
      
      return result.rows.map(row => ({
        id: row.id,
        name: row.name,
        uniprot: row.uniprot,
        gene: row.gene,
        organism: row.organism,
        target_class: row.target_class || 'Unknown'
      }));
    } finally {
      client.release();
    }
  }

  async getMechanismOfAction(drugId?: number, targetId?: number, limit: number = 20): Promise<MechanismOfAction[]> {
    const client = await this.pool.connect();
    try {
      let sql = `
        SELECT 
          s.id as drug_id,
          s.name as drug_name,
          atf.target_id,
          atf.target_name,
          atf.gene as target_gene,
          atf.accession as uniprot,
          atf.action_type as moa_type,
          atf.moa_source as evidence_source
        FROM structures s
        JOIN act_table_full atf ON s.id = atf.struct_id
        WHERE atf.moa = 1
      `;
      
      const params: any[] = [];
      let paramCount = 0;
      
      if (drugId) {
        paramCount++;
        sql += ` AND s.id = $${paramCount}`;
        params.push(drugId);
      }
      
      if (targetId) {
        paramCount++;
        sql += ` AND atf.target_id = $${paramCount}`;
        params.push(targetId);
      }
      
      paramCount++;
      sql += ` ORDER BY s.name, atf.target_name LIMIT $${paramCount}`;
      params.push(limit);
      
      const result = await client.query(sql, params);
      
      return result.rows.map(row => ({
        drug_id: row.drug_id,
        drug_name: row.drug_name,
        target_id: row.target_id,
        target_name: row.target_name,
        target_gene: row.target_gene,
        uniprot: row.uniprot,
        moa_type: row.moa_type || 'unknown',
        evidence_source: row.evidence_source || 'DrugCentral'
      }));
    } finally {
      client.release();
    }
  }

  async getBioactivityData(drugId?: number, targetId?: number, activityType?: string, limit: number = 20): Promise<BioactivityData[]> {
    const client = await this.pool.connect();
    try {
      let sql = `
        SELECT 
          s.id as drug_id,
          s.name as drug_name,
          atf.target_id,
          atf.target_name,
          atf.gene as target_gene,
          atf.act_type as activity_type,
          atf.act_value as activity_value,
          atf.act_unit as activity_unit,
          atf.act_source as source,
          atf.relation,
          atf.organism
        FROM structures s
        JOIN act_table_full atf ON s.id = atf.struct_id
        WHERE atf.act_value IS NOT NULL
      `;
      
      const params: any[] = [];
      let paramCount = 0;
      
      if (drugId) {
        paramCount++;
        sql += ` AND s.id = $${paramCount}`;
        params.push(drugId);
      }
      
      if (targetId) {
        paramCount++;
        sql += ` AND atf.target_id = $${paramCount}`;
        params.push(targetId);
      }
      
      if (activityType) {
        paramCount++;
        sql += ` AND atf.act_type ILIKE $${paramCount}`;
        params.push(`%${activityType}%`);
      }
      
      paramCount++;
      sql += ` ORDER BY atf.act_value ASC LIMIT $${paramCount}`;
      params.push(limit);
      
      const result = await client.query(sql, params);
      
      return result.rows.map(row => ({
        drug_id: row.drug_id,
        drug_name: row.drug_name,
        target_id: row.target_id,
        target_name: row.target_name,
        target_gene: row.target_gene,
        activity_type: row.activity_type,
        activity_value: row.activity_value ? parseFloat(row.activity_value) : undefined,
        activity_unit: row.activity_unit,
        source: row.source,
        relation: row.relation,
        organism: row.organism
      }));
    } finally {
      client.release();
    }
  }

  async getDrugTargetsByDrug(drugId: number): Promise<TargetInfo[]> {
    const client = await this.pool.connect();
    try {
      const sql = `
        SELECT DISTINCT
          atf.target_id as id,
          atf.target_name as name,
          atf.gene,
          atf.organism,
          atf.target_class,
          atf.accession as uniprot
        FROM act_table_full atf
        WHERE atf.struct_id = $1
        ORDER BY atf.target_name
      `;
      
      const result = await client.query(sql, [drugId]);
      
      return result.rows.map(row => ({
        id: row.id,
        name: row.name,
        uniprot: row.uniprot,
        gene: row.gene,
        organism: row.organism || 'Unknown',
        target_class: row.target_class || 'Unknown'
      }));
    } finally {
      client.release();
    }
  }

  async getDrugsByTarget(targetId: number): Promise<DrugInfo[]> {
    const client = await this.pool.connect();
    try {
      const sql = `
        SELECT DISTINCT 
          s.id,
          s.name,
          s.cas_reg_no,
          s.smiles,
          s.inchi,
          s.cd_molweight,
          s.cd_formula
        FROM structures s
        JOIN act_table_full atf ON s.id = atf.struct_id
        WHERE atf.target_id = $1
        ORDER BY s.name
      `;
      
      const result = await client.query(sql, [targetId]);
      
      // Get synonyms for each drug
      const drugs: DrugInfo[] = [];
      for (const row of result.rows) {
        const synResult = await client.query(
          'SELECT synonym FROM synonyms WHERE id = $1',
          [row.id]
        );
        
        drugs.push({
          id: row.id,
          name: row.name,
          cas_reg_no: row.cas_reg_no,
          synonyms: synResult.rows.map(s => s.synonym),
          smiles: row.smiles,
          inchi: row.inchi,
          molecular_weight: row.cd_molweight,
          formula: row.cd_formula
        });
      }
      
      return drugs;
    } finally {
      client.release();
    }
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
} 