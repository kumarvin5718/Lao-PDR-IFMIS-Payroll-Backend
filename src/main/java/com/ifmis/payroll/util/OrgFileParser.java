package com.ifmis.payroll.util;

import com.ifmis.payroll.dto.OrgUploadRowDto;
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
public class OrgFileParser {

    public List<OrgUploadRowDto> parseFile(MultipartFile file) throws IOException {
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

    private List<OrgUploadRowDto> parseCSV(MultipartFile file) throws IOException {
        List<OrgUploadRowDto> rows = new ArrayList<>();
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
                if (row.length < 7) {
                    log.warn("Skipping invalid row: insufficient columns");
                    continue;
                }
                try {
                    OrgUploadRowDto dto = new OrgUploadRowDto();
                    dto.setMinistryName(row[0].trim());
                    dto.setMinistryKey(row[1].trim());
                    dto.setDepartmentName(row[2].trim());
                    dto.setDeptKey(row[3].trim());
                    dto.setProfessionCategory(row[4].trim());
                    dto.setNaAllowanceEligible(row[5].trim());
                    dto.setFieldAllowanceType(row[6].trim());
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

    private List<OrgUploadRowDto> parseExcel(MultipartFile file) throws IOException {
        List<OrgUploadRowDto> rows = new ArrayList<>();
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
                    OrgUploadRowDto dto = new OrgUploadRowDto();
                    dto.setMinistryName(getCellValue(row.getCell(0)).trim());
                    dto.setMinistryKey(getCellValue(row.getCell(1)).trim());
                    dto.setDepartmentName(getCellValue(row.getCell(2)).trim());
                    dto.setDeptKey(getCellValue(row.getCell(3)).trim());
                    dto.setProfessionCategory(getCellValue(row.getCell(4)).trim());
                    dto.setNaAllowanceEligible(getCellValue(row.getCell(5)).trim());
                    dto.setFieldAllowanceType(getCellValue(row.getCell(6)).trim());
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
