Great, I’ll explore the ChEMBL and EMBL-EBI APIs to determine how you can query for drugs that target a gene using its symbol. I’ll focus on endpoints that return machine-readable data (e.g., JSON) suitable for use with an LLM, and include drug status information. I’ll let you know what I find.


# Querying Drug Targets by Gene Symbol: ChEMBL vs. EMBL-EBI APIs

## Using the ChEMBL API (RESTful)

**Gene Symbol Search:** ChEMBL’s REST API allows querying targets by gene symbol through its search endpoint. For example, a GET request to the target search API (e.g. `.../target/search.json?q=BRD4`) will return any targets whose names or synonyms match “BRD4”. This yields a JSON response containing matching targets, including fields like the ChEMBL target ID (`target_chembl_id`), preferred target name, organism, and synonyms. From this, you can identify the specific target record for your gene of interest.

**Retrieving Drugs for a Target:** Once you have the target’s ChEMBL ID, you can retrieve associated drugs (compounds) known to act on that target. Two approaches are common:

* *Mechanism of Action Endpoint:* The `/mechanism` endpoint returns curated drug–target relationships, primarily for approved drugs. For example, querying `.../mechanism.json?target_chembl_id=CHEMBL203` (if CHEMBL203 is the target ID for EGFR) would return a JSON list of mechanism entries. Each entry includes the drug’s ChEMBL ID (`molecule_chembl_id`), drug name, the mechanism of action description, action type (e.g. *INHIBITOR*), and the target name/ID. Notably, it also includes a `max_phase` field indicating the highest development phase for that drug. A `max_phase` of 4 corresponds to an approved drug, while lower numbers (1–3) indicate investigational stages (phase I, II, III trials). A boolean `disease_efficacy` flag is also present, denoting whether the target is believed to drive the drug’s therapeutic effect. This mechanism endpoint is very useful for getting **approved drugs**, and often late-stage investigational drugs, targeting the gene’s protein.

* *Bioactivity/Activity Endpoint:* For a broader net, the `/activity` resource can list all recorded compound–target activities. For example, `.../activity.json?target_chembl_id=CHEMBL203` would retrieve bioactivity records (assay results) for any compound tested against that target. The data will include many research compounds, not just drugs. If needed, one can filter or post-process these to find molecules with a development status. One strategy is to filter for molecules with `max_phase >= 1` (i.e., at least in clinical trials). The ChEMBL API supports filters on fields (including related object fields) using query parameters. For instance, one could combine filters to retrieve molecules active on the target that have reached at least phase 1: `.../activity.json?target_chembl_id=CHEMBL203&molecule_chembl_id__max_phase__gte=1`. This would return activities for target CHEMBL203 only for compounds that have *max\_phase* ≥ 1 (meaning they are either investigational or approved drugs). The result is JSON structured with an array of activity records (`activities`) each containing fields like `molecule_chembl_id`, `standard_value`/potency, etc., plus pagination info.

**Data Format:** ChEMBL’s API returns structured data in multiple formats (XML by default, or JSON/YAML if specified). For integration with JavaScript, JSON is ideal – you can request `.json` endpoints or use `Accept: application/json`. The JSON responses include a top-level list (e.g. `"mechanisms"` or `"activities"`), each entry being a dictionary of fields. For example, a snippet from a mechanism query might look like:

```json
{
  "mechanisms": [
    {
      "molecule_chembl_id": "CHEMBL1257",
      "molecule_name": "Gefitinib",
      "target_chembl_id": "CHEMBL203",
      "target_name": "Epidermal growth factor receptor",
      "mechanism_of_action": "Epidermal growth factor receptor inhibitor",
      "action_type": "INHIBITOR",
      "max_phase": 4,
      "disease_efficacy": true
      // ...additional fields like references, etc.
    },
    ...
  ],
  "page_meta": { "total_count": X, "limit": 20, ... }
}
```

Such JSON is machine-readable and easy to feed into an LLM for summarization. The `max_phase` field indicates the drug’s status (in the above example, 4 means approved). If a drug were only in clinical trials, you might see `max_phase: 2` (for instance, a Phase II compound).

**Drug Status Information:** In ChEMBL data, drug development status is captured by the numeric `max_phase` as described. There isn’t a textual “approved”/“investigational” label in the mechanism or molecule output, but you can interpret `max_phase` (4 = approved, 0–3 = various trial stages). The ChEMBL “drug” and “drug\_indication” endpoints can also provide context on approval and indications. For example, the `/drug` endpoint aggregates regulatory approval data for drug compounds (it contains entries for approved drugs, with fields like FDA approval year, etc.), and the `/drug_indication` endpoint links drugs to indications with phase info. If needed, a developer could cross-reference the molecule’s ChEMBL ID against these to confirm if it’s approved and for what use. However, for a quick query starting from a gene, using the target → mechanism approach is usually sufficient to get the drugs and see their status.

**API Access & Usage Constraints:** ChEMBL’s API is open and does not require authentication or an API key. It supports cross-origin requests (CORS), meaning you can call it directly from client-side JavaScript in a web application. The API is **paginated** – by default, only 20 results are returned per call, with a `limit` parameter available to increase up to 1000 per page. The JSON response includes `page_meta` with next/prev page links and total counts for easy navigation. For reasonable query volumes (e.g. looking up one gene’s data at a time), rate limiting is generally not an issue. There is no fixed public rate limit published, but the service will throttle or deny excessively heavy use to protect performance. It’s recommended to design the client to page through results if needed (rather than requesting very large datasets in one go). In practice, querying a single target’s drug list is efficient and will likely return well under these limits.

*Example – ChEMBL Workflow:* Suppose the gene symbol is **TP53**. First, you’d search the target database:

```http
GET https://www.ebi.ac.uk/chembl/api/data/target/search.json?q=TP53
```

This might return a list of targets including *“Cellular tumor antigen p53”* with a `target_chembl_id` (say, CHEMBL4296 for human p53). Next, get drugs targeting it:

```http
GET https://www.ebi.ac.uk/chembl/api/data/mechanism.json?target_chembl_id=CHEMBL4296
```

The JSON response would list known drug mechanisms involving p53. If p53 has no approved drugs (as is the case for the p53 protein), this may return an empty list or only experimental molecules. In such cases, one could query the broader activities:

```http
GET https://www.ebi.ac.uk/chembl/api/data/activity.json?target_chembl_id=CHEMBL4296&limit=1000
```

and then filter the resulting compounds by `max_phase` in your code (or by adding `&molecule_chembl_id__max_phase__gte=1` as a filter). This would yield any compounds tested on p53 that have reached at least clinical trials. Each approach returns JSON that a JavaScript app can parse directly. The ChEMBL data, being well-structured, can be summarized by an LLM or used to display drug lists, etc.

## Using EMBL-EBI’s Open Targets API (GraphQL)

Another route is to leverage the Open Targets Platform API, an EMBL-EBI resource that integrates data from ChEMBL and other sources. Open Targets focuses on target–drug and target–disease associations, and it provides a high-level **GraphQL API** for queries. This is well-suited for starting from a gene and retrieving drugs.

**Gene Symbol to Target ID:** Open Targets uses the Ensembl gene ID as the primary identifier for targets (genes). That means you’ll need the Ensembl ID for your gene symbol. If you have only the symbol (e.g. "BRCA1"), you can either use the Open Targets *search* API or an external service (like Ensembl’s REST API) to map “BRCA1” to an Ensembl ID (in this case, ENSG00000012048). Open Targets’ GraphQL has a search query type that can find entities by name; for example, you could query the `search` endpoint for `"BRCA1"` to get the matching target’s Ensembl ID. Once you have the Ensembl ID, you can use the `target` query.

**KnownDrugs Endpoint:** The Open Targets GraphQL schema includes a **`knownDrugs`** field under the `target` object. This is essentially a table of drugs (and their indications) that are known to modulate that target. By querying this, you can get all approved and investigational drugs for the gene’s product in one call. For example, the GraphQL query below asks for all drugs targeting APP (using APP’s Ensembl ID ENSG00000142192) and some of their details:

```graphql
query getTargetDrugs {
  target(ensemblId: "ENSG00000142192") {
    knownDrugs {
      uniqueDrugs
      rows {
        drug {
          id
          name
          isApproved
          yearOfFirstApproval
          hasBeenWithdrawn
          blackBoxWarning
        }
        disease {
          name
          id
        }
        phase
        status
        ctIds
      }
    }
  }
}
```

This single query will return a JSON response containing the list of drugs (`knownDrugs.rows`) that have APP as a target. Each entry provides the drug’s **ChEMBL ID** (`drug.id`), name, and key status flags (whether it’s approved (`isApproved`), the first approval year, if it has a black-box warning or has been withdrawn). It also provides the associated **disease/indication** for that drug-target pairing (`disease.name` and ID), and the development **phase** and **status** of the drug for that indication. For example, a drug that is on the market might show `isApproved: true`, `phase: "Phase IV"`, and `status: "Approved"`; a clinical-stage drug might have `isApproved: false`, `phase: "Phase II"`, and `status: "Phase 2"` (or similar text). The `ctIds` field can list clinical trial identifiers if applicable. Essentially, this gives both approved drugs and those in trials, with explicit status labels.

**Output Format:** The GraphQL API returns JSON data as well. The structure will be nested under the query’s fields (in this case `data.target.knownDrugs.rows` etc.). This is highly structured and machine-readable. An LLM could easily summarize the output (e.g., “There are X known drugs targeting gene Y, including DrugA (approved) and DrugB (Phase II investigational)…”). Because you can request exactly the fields you need, the response can be kept concise. Open Targets covers drugs from the ChEMBL drug corpus (including those from DrugBank and other curated drug sets), so it tends to include all compounds with known target activity and an assigned indication. This matches the user’s need for both approved and investigational drugs.

**Drug Status Info:** As seen above, the API explicitly provides fields for approval status. `isApproved` is a boolean (true if the drug is approved for at least one indication). There is also a `status` field which is a text descriptor (e.g. “Approved”, “Phase 1”, “Phase 2”, etc.), and a numeric `phase` field corresponding to the highest clinical trial phase in which the drug has been or is being tested. This means you do not need to interpret numeric codes yourself – the output directly tells you if a drug is approved or what phase it’s in. Open Targets aggregates this from ChEMBL and other sources, so it’s quite complete. For example, if querying a cancer target, you might see an entry like: *drug.name: Pembrolizumab, isApproved: true, status: "Approved", phase: "Phase IV"* for an approved immunotherapy, and another entry *drug.name: An Investigational Drug, isApproved: false, status: "Phase 2", phase: "Phase II"* for a drug in trials.

**Access & Rate Limiting:** The Open Targets GraphQL endpoint (`https://api.platform.opentargets.org/api/v4/graphql`) is publicly accessible without authentication. You can POST your GraphQL queries from JavaScript (e.g., using `fetch` in a web app) – the API supports CORS so that should work in-browser. The platform even provides a GraphQL Playground UI for testing queries. In terms of limitations, Open Targets encourages reasonable use: retrieving data for a single target or a few targets on demand is fine, but they discourage hitting the API to download bulk data repeatedly. If you need data for many genes or a systematic sweep, they recommend using their pre-downloaded datasets or BigQuery mirror. For a tool that looks up one gene at a time interactively, the GraphQL API is perfectly suited. Just be mindful that by default some GraphQL query results may be capped (often 10 or 25 items) if not specified – however, the `knownDrugs` field is designed to return *all* known drugs for that target (the `uniqueDrugs` count can be used to see how many). There is no strict published rate-limit (no API key), but as a courtesy avoid very rapid-fire queries in parallel. Each query can fetch multiple fields, reducing the need for many round-trips.

*Example – Open Targets Query:* If the user has **BRCA1**, first find BRCA1’s Ensembl ID (ENSG00000012048). Then the GraphQL query might be:

```graphql
query {
  target(ensemblId: "ENSG00000012048") {
    approvedSymbol
    knownDrugs {
      uniqueDrugs
      rows {
        drug { id name isApproved }
        disease { name }
        phase
        status
      }
    }
  }
}
```

The JSON response will include BRCA1 (`approvedSymbol: "BRCA1"`) and a list of drugs in `knownDrugs.rows`. Each row will have a drug ID (often a ChEMBL ID like CHEMBL1201586 for olaparib), the drug name (e.g. Olaparib), `isApproved` true/false, and the `status`/`phase` indicating its highest status (olaparib would show approved Phase IV, whereas an experimental ATR inhibitor targeting BRCA1 pathway might show Phase II). This one query gives a quick overview of all relevant drugs and their development status.

## Summary of Capabilities and Considerations

Both the ChEMBL REST API and the Open Targets (EMBL-EBI) API can be used in a JavaScript application to go from a gene symbol to drugs targeting that gene:

* **Endpoints & Query by Gene:** ChEMBL offers a RESTful *target search* endpoint where you can plug in a gene symbol and find the corresponding target entry. Open Targets provides a GraphQL *search* or the ability to query the `target` by Ensembl gene ID (requiring one extra step to map the symbol).

* **Data Format:** Both return **structured JSON** data. ChEMBL’s endpoints can be called with `.json` and return data in pages (with lists of results under keys like `"targets"`, `"mechanisms"`, etc.), which is easy to parse. Open Targets GraphQL returns JSON with nested fields corresponding to the requested schema. This structured output is suitable for LLM consumption or further processing in JavaScript.

* **Drug Status Info:** Both APIs include drug status in the results, albeit in different forms. ChEMBL data uses a numeric `max_phase` field on compounds (and also shows an `approved` flag on certain records like the Drug endpoint). You may need to translate numeric phases to labels (1–3 = investigational phases, 4 = approved). Open Targets already provides explicit status labels (`isApproved`, `status`, `phase`) for each drug–target association. This means your application can directly display or use terms like “Approved” or “Phase 2” from the API response.

* **Authentication & CORS:** Neither API requires authentication for public use. ChEMBL’s web services are openly accessible and support CORS (and even JSONP) for JavaScript clients. The Open Targets GraphQL API is also publicly accessible; you can POST queries from a web app without special tokens. Both are maintained by EMBL-EBI and intended for broad use in tools and pipelines.

* **Rate Limiting & Usage Limits:** Both services impose some sane limits to prevent abuse. ChEMBL paginates results and limits each page to 1000 items, which is generally sufficient for target drug lists (usually much smaller than 1000). There isn’t a fixed call-per-second limit published, but one should avoid flooding the API; moderate use is fine. Open Targets GraphQL encourages targeted queries; while there’s no fixed rate limit documented, the team suggests avoiding thousands of sequential single-entity queries. If your use case needed data on many genes, they’d prefer you use their bulk data dumps. For an interactive gene query tool, these APIs are fast and reliable. Just ensure your code handles pagination (for ChEMBL) or uses appropriate GraphQL query structure (for Open Targets) to get all results you need.

* **Example Use Cases:** If a developer wants **both approved and investigational drugs** for a given gene, Open Targets’ `knownDrugs` is very convenient – it returns a ready-made list of all such drugs with rich annotations in one request. On the other hand, ChEMBL’s API can achieve the same with a couple of calls and gives more low-level control. For instance, one could retrieve all compounds tested against the gene’s protein and then filter by `max_phase` or join with ChEMBL’s drug indications to find those in clinical stages. This might be more involved, but ChEMBL’s data is very granular and up-to-date (ChEMBL is updated frequently with new releases). Open Targets is also updated regularly (with periodic data releases) and integrates ChEMBL’s latest drug data.

In summary, **ChEMBL API** provides direct access to target and molecule information with flexible querying (ideal if you want raw data and full control), while the **Open Targets API** provides a higher-level, convenient view of “known drugs” for a gene (ideal for quick lookups of drugs & status). Both return machine-readable JSON suitable for summarization. A developer using JavaScript can choose either or even combine them – for example, use ChEMBL to confirm detailed properties of a drug (like chemical structure or additional bioactivities) after obtaining a list from Open Targets. All endpoints discussed are accessible via AJAX calls thanks to CORS support, making integration into a web-based tool feasible without a proxy. By leveraging these APIs, one can build a workflow that takes a gene symbol, finds the corresponding target, and outputs a list of drugs (approved and in trials) that modulate that target, complete with their development status and other relevant info.

**References:**

* ChEMBL API Documentation – Web Services (REST)
* ChEMBL Blog (technical aspects of ChEMBL release) – example of target search by gene name
* Open Targets Platform Documentation – GraphQL API and Known Drugs field
* Open Targets Community Q\&A – using GraphQL to fetch drugs for a target, including example queries
