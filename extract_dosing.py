#!/usr/bin/env python3
"""Extract and organize dosing information from clinical trials"""

import json
import urllib.request
import urllib.parse

def get_study_details(nct_id):
    """Get full study details from ClinicalTrials.gov API"""
    base_url = "https://clinicaltrials.gov/api/v2/studies"
    params = {
        "filter.ids": nct_id,
        "format": "json"
    }
    
    url = f"{base_url}?{urllib.parse.urlencode(params)}"
    
    try:
        with urllib.request.urlopen(url) as response:
            data = json.loads(response.read())
            studies = data.get('studies', [])
            return studies[0] if studies else None
    except Exception as e:
        print(f"Error fetching data for {nct_id}: {e}", file=sys.stderr)
        return None

def extract_dosing_info(study):
    """Extract dosing information from study"""
    proto = study['protocolSection']
    ident = proto['identificationModule']
    elig = proto['eligibilityModule']
    arms_interventions = proto.get('armsInterventionsModule', {})
    desc = proto.get('descriptionModule', {})
    
    dosing_info = {
        'nct_id': ident['nctId'],
        'title': ident['briefTitle'],
        'condition': ', '.join(proto['conditionsModule'].get('conditions', [])),
        'age_range': f"{elig.get('minimumAge', 'N/A')} - {elig.get('maximumAge', 'N/A')}",
        'dosing_details': []
    }
    
    # Extract from interventions
    for intervention in arms_interventions.get('interventions', []):
        if 'N-acetylcysteine' in intervention.get('name', '').lower() or 'NAC' in intervention.get('name', '').upper():
            dosing = {
                'intervention_name': intervention.get('name', ''),
                'description': intervention.get('description', ''),
                'type': intervention.get('type', ''),
                'other_names': intervention.get('otherNames', [])
            }
            dosing_info['dosing_details'].append(dosing)
    
    # Extract from description
    brief_summary = desc.get('briefSummary', '')
    detailed_desc = desc.get('detailedDescription', '')
    
    # Look for dosing information in text
    dosing_text = []
    for text in [brief_summary, detailed_desc]:
        if text:
            # Look for common dosing patterns
            import re
            patterns = [
                r'(\d+\s*(?:mg|mg/kg|mg/kg/day|mg/kg/d|mg/d|mg/day|mg/12 hours|mg/12 hrs))',
                r'(\d+\s*(?:mg|mg/kg)\s*(?:once|twice|three times|daily|per day|every|q\.?d\.?|b\.?i\.?d\.?|t\.?i\.?d\.?))',
                r'(dose[:\s]+[^\.]+)',
                r'(dosing[:\s]+[^\.]+)',
                r'(\d+\s*(?:mg|mg/kg)[^\.]*(?:orally|PO|IV|intravenous|oral))',
            ]
            for pattern in patterns:
                matches = re.findall(pattern, text, re.IGNORECASE)
                if matches:
                    dosing_text.extend(matches)
    
    if dosing_text:
        dosing_info['dosing_from_text'] = list(set(dosing_text))[:5]  # Limit to 5 unique matches
    
    return dosing_info

def main():
    nct_ids = [
        "NCT04916080",
        "NCT02080182",
        "NCT05611086",
        "NCT02168387",
        "NCT00248625",
        "NCT01172275",
        "NCT00993265"
    ]
    
    print("="*100)
    print("DOSING INFORMATION SUMMARY")
    print("="*100)
    
    all_dosing = []
    
    for nct_id in nct_ids:
        study = get_study_details(nct_id)
        if study:
            dosing_info = extract_dosing_info(study)
            all_dosing.append(dosing_info)
    
    print("\nDETAILED DOSING BY STUDY:\n")
    for i, info in enumerate(all_dosing, 1):
        print(f"{i}. {info['title']}")
        print(f"   NCT ID: {info['nct_id']}")
        print(f"   Condition: {info['condition']}")
        print(f"   Age Range: {info['age_range']}")
        print(f"   Dosing Details:")
        for detail in info['dosing_details']:
            if detail['description']:
                print(f"      - {detail['description']}")
        if 'dosing_from_text' in info and info['dosing_from_text']:
            print(f"   Additional dosing info found in text:")
            for text in info['dosing_from_text']:
                print(f"      - {text}")
        print()
    
    print("\n" + "="*100)
    print("DOSING SUMMARY BY ROUTE AND DOSE:")
    print("="*100)
    
    # Organize by route
    oral_doses = []
    iv_doses = []
    other_doses = []
    
    for info in all_dosing:
        for detail in info['dosing_details']:
            desc = detail['description'].lower()
            if 'oral' in desc or 'po' in desc or 'tablet' in desc or 'capsule' in desc:
                oral_doses.append((info['nct_id'], info['age_range'], detail['description']))
            elif 'iv' in desc or 'intravenous' in desc or 'infusion' in desc:
                iv_doses.append((info['nct_id'], info['age_range'], detail['description']))
            else:
                other_doses.append((info['nct_id'], info['age_range'], detail['description']))
    
    if oral_doses:
        print("\nORAL DOSING:")
        for nct, age, dose in oral_doses:
            print(f"   {nct} (Age: {age}): {dose}")
    
    if iv_doses:
        print("\nINTRAVENOUS DOSING:")
        for nct, age, dose in iv_doses:
            print(f"   {nct} (Age: {age}): {dose}")
    
    if other_doses:
        print("\nOTHER ROUTES:")
        for nct, age, dose in other_doses:
            print(f"   {nct} (Age: {age}): {dose}")

if __name__ == "__main__":
    import sys
    main()

