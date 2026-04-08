package com.ifmis.payroll.util;

import com.ifmis.payroll.dto.LocationUploadRowDto;
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
public class LocationFileParser {

    public List<LocationUploadRowDto> parseFile(MultipartFile file) throws IOException {
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

    private List<LocationUploadRowDto> parseCSV(MultipartFile file) throws IOException {
        List<LocationUploadRowDto> rows = new ArrayList<>();
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
                if (row.length < 9) {
                    log.warn("Skipping invalid row: insufficient columns");
                    continue;
                }
                try {
                    LocationUploadRowDto dto = new LocationUploadRowDto();
                    dto.setCountry(row[0].trim());
                    dto.setCountryKey(row[1].trim());
                    dto.setProvinceKey(row[2].trim());
                    dto.setProvincePosting(row[3].trim());
                    dto.setDistrictKey(row[4].trim());
                    dto.setDistrict(row[5].trim());
                    dto.setIsRemote(row[6].trim());
                    dto.setIsHazardous(row[7].trim());
                    dto.setNotes(row[8].trim());
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

    private List<LocationUploadRowDto> parseExcel(MultipartFile file) throws IOException {
        List<LocationUploadRowDto> rows = new ArrayList<>();
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
                    LocationUploadRowDto dto = new LocationUploadRowDto();
                    dto.setCountry(getCellValue(row.getCell(0)).trim());
                    dto.setCountryKey(getCellValue(row.getCell(1)).trim());
                    dto.setProvinceKey(getCellValue(row.getCell(2)).trim());
                    dto.setProvincePosting(getCellValue(row.getCell(3)).trim());
                    dto.setDistrictKey(getCellValue(row.getCell(4)).trim());
                    dto.setDistrict(getCellValue(row.getCell(5)).trim());
                    dto.setIsRemote(getCellValue(row.getCell(6)).trim());
                    dto.setIsHazardous(getCellValue(row.getCell(7)).trim());
                    dto.setNotes(getCellValue(row.getCell(8)).trim());
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
