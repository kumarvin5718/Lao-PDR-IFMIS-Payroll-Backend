package com.ifmis.payroll.service;

import com.ifmis.payroll.dto.OrgUploadResponseDto;
import com.ifmis.payroll.dto.OrgUploadRowDto;
import com.ifmis.payroll.entity.master.*;
import com.ifmis.payroll.repository.*;
import com.ifmis.payroll.util.OrgFileParser;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.*;

@Service
@RequiredArgsConstructor
@Slf4j
public class OrgUploadService {

    private final MinistryRepository ministryRepository;
    private final DepartmentRepository departmentRepository;
    private final ProfessionCategoryRepository professionCategoryRepository;
    private final LkOrgMasterRepository lkOrgMasterRepository;
    private final OrgFileParser orgFileParser;

    @Transactional
    public OrgUploadResponseDto uploadOrganizations(MultipartFile file) {
        List<OrgUploadRowDto> rows;
        try {
            rows = orgFileParser.parseFile(file);
        } catch (IOException e) {
            log.error("Error parsing file", e);
            throw new RuntimeException("Failed to parse file", e);
        }

        // Caches
        Map<String, Ministry> ministryCache = new HashMap<>();
        Map<String, Department> departmentCache = new HashMap<>();
        Map<String, ProfessionCategory> professionCache = new HashMap<>();

        // Collections for batch save
        List<Ministry> ministriesToSave = new ArrayList<>();
        List<Department> departmentsToSave = new ArrayList<>();
        List<ProfessionCategory> professionsToSave = new ArrayList<>();
        List<LkOrgMaster> orgsToSave = new ArrayList<>();

        int ministriesCreated = 0;
        int departmentsCreated = 0;
        int professionsCreated = 0;
        int orgRecordsCreated = 0;
        int duplicatesSkipped = 0;
        int failedRows = 0;

        for (OrgUploadRowDto row : rows) {
            try {
                // Validate required fields
                if (row.getMinistryKey() == null || row.getMinistryKey().trim().isEmpty() ||
                    row.getDeptKey() == null || row.getDeptKey().trim().isEmpty() ||
                    row.getProfessionCategory() == null || row.getProfessionCategory().trim().isEmpty()) {
                    log.warn("Skipping row due to missing required fields: {}", row);
                    failedRows++;
                    continue;
                }

                // Get or create Ministry
                String ministryName = row.getMinistryName() != null ? row.getMinistryName().trim() : row.getMinistryKey().trim();
                Ministry ministry = ministryCache.computeIfAbsent(ministryName, name -> {
                    Optional<Ministry> existing = ministryRepository.findByName(name);
                    if (existing.isPresent()) {
                        return existing.get();
                    } else {
                        Ministry newMinistry = new Ministry();
                        newMinistry.setMinistryKey(row.getMinistryKey().trim());
                        newMinistry.setName(name);
                        ministriesToSave.add(newMinistry);
                        return newMinistry;
                    }
                });

                // Get or create Department
                String departmentName = row.getDepartmentName() != null ? row.getDepartmentName().trim() : row.getDeptKey().trim();
                Department department = departmentCache.computeIfAbsent(departmentName, name -> {
                    Optional<Department> existing = departmentRepository.findByName(name);
                    if (existing.isPresent()) {
                        return existing.get();
                    } else {
                        Department newDepartment = new Department();
                        newDepartment.setDepartmentKey(row.getDeptKey().trim());
                        newDepartment.setName(name);
                        departmentsToSave.add(newDepartment);
                        return newDepartment;
                    }
                });

                // Get or create ProfessionCategory
                ProfessionCategory professionCategory = professionCache.computeIfAbsent(row.getProfessionCategory().trim(), name -> {
                    Optional<ProfessionCategory> existing = professionCategoryRepository.findByName(name);
                    if (existing.isPresent()) {
                        return existing.get();
                    } else {
                        ProfessionCategory newProfession = new ProfessionCategory();
                        newProfession.setId(UUID.randomUUID());
                        newProfession.setName(name);
                        professionsToSave.add(newProfession);
                        return newProfession;
                    }
                });

                // Check if LkOrgMaster already exists
                Optional<LkOrgMaster> existingOrg = lkOrgMasterRepository.findByMinistryAndDepartmentAndProfessionCategory(ministry, department, professionCategory);
                if (existingOrg.isPresent()) {
                    duplicatesSkipped++;
                    continue;
                }

                // Parse NA Allowance Eligible
                Boolean naAllowanceEligible = parseBoolean(row.getNaAllowanceEligible());

                // Create LkOrgMaster
                LkOrgMaster org = LkOrgMaster.builder()
                        .id(UUID.randomUUID())
                        .ministry(ministry)
                        .department(department)
                        .professionCategory(professionCategory)
                        .naAllowanceEligible(naAllowanceEligible)
                        .fieldAllowanceType(row.getFieldAllowanceType() != null ? row.getFieldAllowanceType().trim() : null)
                        .build();
                orgsToSave.add(org);

            } catch (Exception e) {
                log.error("Error processing row: {}", row, e);
                failedRows++;
            }
        }

        // Batch save
        if (!ministriesToSave.isEmpty()) {
            ministryRepository.saveAll(ministriesToSave);
            ministriesCreated = ministriesToSave.size();
        }
        if (!departmentsToSave.isEmpty()) {
            departmentRepository.saveAll(departmentsToSave);
            departmentsCreated = departmentsToSave.size();
        }
        if (!professionsToSave.isEmpty()) {
            professionCategoryRepository.saveAll(professionsToSave);
            professionsCreated = professionsToSave.size();
        }
        if (!orgsToSave.isEmpty()) {
            lkOrgMasterRepository.saveAll(orgsToSave);
            orgRecordsCreated = orgsToSave.size();
        }

        return new OrgUploadResponseDto(rows.size(), ministriesCreated, departmentsCreated, professionsCreated, orgRecordsCreated, duplicatesSkipped, failedRows);
    }

    private Boolean parseBoolean(String value) {
        if (value == null || value.trim().isEmpty()) {
            return false;
        }
        String trimmed = value.trim().toLowerCase();
        return "yes".equals(trimmed) || "true".equals(trimmed);
    }
}
