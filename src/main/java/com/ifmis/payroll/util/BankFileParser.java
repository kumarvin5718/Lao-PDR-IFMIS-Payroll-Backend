package com.ifmis.payroll.util;

import com.ifmis.payroll.dto.BankUploadRowDto;
import com.opencsv.CSVReader;
import com.opencsv.exceptions.CsvException;
import lombok.extern.slf4j.Slf4j;
import org.apache.poi.ss.usermodel.*;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.springframework.stereotype.Component;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.io.InputStreamReader;
import java.util.ArrayList;
import java.util.List;

@Component
@Slf4j
public class BankFileParser {

    public List<BankUploadRowDto> parseFile(MultipartFile file) throws IOException {
        String filename = file.getOriginalFilename();
        if (filename == null) {
            throw new IllegalArgumentException("File name is null");
        }

        if (filename.endsWith(".csv")) {
            return parseCSV(file);
        } else if (filename.endsWith(".xlsx") || filename.endsWith(".xls")) {
            return parseExcel(file);
        } else {
            throw new IllegalArgumentException("Unsupported file type: " + filename);
        }
    }

    private List<BankUploadRowDto> parseCSV(MultipartFile file) throws IOException {
        List<BankUploadRowDto> rows = new ArrayList<>();
        try (CSVReader csvReader = new CSVReader(new InputStreamReader(file.getInputStream()))) {
            List<String[]> allData = csvReader.readAll();
            if (allData.isEmpty()) {
                return rows;
            }

            // Skip header
            boolean isHeader = true;
            for (String[] row : allData) {
                if (isHeader) {
                    isHeader = false;
                    continue;
                }
                if (row.length < 14) {
                    log.warn("Skipping invalid row: insufficient columns");
                    continue;
                }
                try {
                    BankUploadRowDto dto = new BankUploadRowDto();
                    dto.setBankName(row[0]);
                    dto.setAbbrev(row[1]);
                    dto.setBankKey(row[2]);
                    dto.setCategory(row[3]);
                    dto.setBranchName(row[4]);
                    dto.setBranchCode(row[5]);
                    dto.setCity(row[6]);
                    dto.setSwiftBICCode(row[7]);
                    dto.setBranchAddress(row[8]);
                    dto.setBankHQAddress(row[9]);
                    dto.setTelephone(row[10]);
                    dto.setOwnership(row[11]);
                    dto.setEstablished(row[12].isEmpty() ? null : Integer.parseInt(row[12]));
                    dto.setWebsite(row[13]);
                    rows.add(dto);
                } catch (Exception e) {
                    log.error("Error parsing CSV row: {}", e.getMessage());
                }
            }
        } catch (CsvException e) {
            throw new IOException("Error reading CSV file", e);
        }
        return rows;
    }

    private List<BankUploadRowDto> parseExcel(MultipartFile file) throws IOException {
        List<BankUploadRowDto> rows = new ArrayList<>();
        try (Workbook workbook = new XSSFWorkbook(file.getInputStream())) {
            Sheet sheet = workbook.getSheetAt(0);
            if (sheet == null) {
                return rows;
            }

            // Skip header
            boolean isHeader = true;
            for (Row row : sheet) {
                if (isHeader) {
                    isHeader = false;
                    continue;
                }
                try {
                    BankUploadRowDto dto = new BankUploadRowDto();
                    dto.setBankName(getCellValue(row.getCell(0)));
                    dto.setAbbrev(getCellValue(row.getCell(1)));
                    dto.setBankKey(getCellValue(row.getCell(2)));
                    dto.setCategory(getCellValue(row.getCell(3)));
                    dto.setBranchName(getCellValue(row.getCell(4)));
                    dto.setBranchCode(getCellValue(row.getCell(5)));
                    dto.setCity(getCellValue(row.getCell(6)));
                    dto.setSwiftBICCode(getCellValue(row.getCell(7)));
                    dto.setBranchAddress(getCellValue(row.getCell(8)));
                    dto.setBankHQAddress(getCellValue(row.getCell(9)));
                    dto.setTelephone(getCellValue(row.getCell(10)));
                    dto.setOwnership(getCellValue(row.getCell(11)));
                    String establishedStr = getCellValue(row.getCell(12));
                    dto.setEstablished(establishedStr.isEmpty() ? null : Integer.parseInt(establishedStr));
                    dto.setWebsite(getCellValue(row.getCell(13)));
                    rows.add(dto);
                } catch (Exception e) {
                    log.error("Error parsing Excel row: {}", e.getMessage());
                }
            }
        }
        return rows;
    }

    private String getCellValue(Cell cell) {
        if (cell == null) {
            return "";
        }
        return switch (cell.getCellType()) {
            case STRING -> cell.getStringCellValue();
            case NUMERIC -> String.valueOf((int) cell.getNumericCellValue());
            case BOOLEAN -> String.valueOf(cell.getBooleanCellValue());
            default -> "";
        };
    }
}
