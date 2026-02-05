# Bins Import Guide

This guide explains how to import warehouse bin data into the system.

## Quick Start

### Option 1: Web Interface (Recommended)
1. Navigate to the Bins page in the dashboard
2. Click the "Import CSV / Excel" button in the top right
3. Select your Excel (.xls, .xlsx) or CSV file
4. The system will automatically import all rows

### Option 2: Command Line
If you have an Excel file and want to convert it to CSV first:

```bash
cd daysweeper
node scripts/import-bins-simple.js "path/to/your/file.xls"
```

This will create a `bins-import.csv` file that you can then upload through the web interface.

## File Format

Your import file should have the following columns:

- **BIN** - The bin location (e.g., A2, A2-1, B5-7)
- **PART NUMBER** - The part number/SKU (required)
- **PART DESCRIPTION** - Description of the part (optional)
- **QTY** or **QUANTITY** - Quantity in stock (optional, defaults to 0)

### Example CSV Format:
```csv
BIN,PART NUMBER,PART DESCRIPTION,QTY
A2,BULK484525-BK2OD TX,"48X45X25 USED BULK BOX-BLK OD",3
A2,METAL59.54838-COLU,"593/4)X45x38 Colapsed Metal B",13
A2-1,BULK37X24X23S U,"37x24x23 Small Steel Bin",22
```

## Features

- **Editable Interface**: Every line in the bins table is editable - just click on any cell to edit
- **Bulk Import**: Import hundreds of items at once
- **Upsert Logic**: If a bin+part combination already exists, it will be updated; otherwise, a new record is created
- **Multiple Formats**: Supports Excel (.xls, .xlsx) and CSV files
- **Flexible Column Names**: The system recognizes various column name formats (e.g., "Part Number", "PartNumber", "Part#", "SKU")

## Sample Data

A sample import file is included: `bins-import.csv` (315 rows from "Parts by Bin 251212.xls")

## Editing Data

After import, you can:
- Click any cell to edit it inline
- Add new rows using the "Add line" button
- Delete individual rows using the trash icon
- Save changes using the "Save" button
- Clear all data using the "Clear all" button (with confirmation)

## Technical Details

- The import uses upsert logic based on the unique combination of `bin` and `partNumber`
- Empty bins are stored as `null` in the database
- Quantities default to 0 if not provided
- The system tracks who changed each record and when