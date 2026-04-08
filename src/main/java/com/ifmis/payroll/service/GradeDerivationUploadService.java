package com.ifmis.payroll.service;

import com.ifmis.payroll.dto.GradeDerivationUploadResponseDto;
import com.ifmis.payroll.dto.GradeDerivationUploadRowDto;
import com.ifmis.payroll.entity.master.EducationLevel;
import com.ifmis.payroll.entity.master.LKGradeDerivationMaster;
import com.ifmis.payroll.repository.EducationLevelRepository;
import com.ifmis.payroll.repository.LKGradeDerivationRepository;
import com.ifmis.payroll.util.GradeDerivationFileParser;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
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
public class GradeDerivationUploadService {

    private final EducationLevelRepository educationLevelRepository;
    private final LKGradeDerivationRepository gradeDerivationRepository;
    private final GradeDerivationFileParser gradeDerivationFileParser;

    @PersistenceContext
    private EntityManager entityManager;

    @Transactional
    public GradeDerivationUploadResponseDto uploadGradeDerivations(MultipartFile file) {
        List<GradeDerivationUploadRowDto> rows;
        try {
            rows = gradeDerivationFileParser.parseFile(file);
        } catch (IOException e) {
            log.error("Error parsing file", e);
            throw new RuntimeException("Failed to parse file", e);
        }

        // Cache
        Map<String, EducationLevel> educationLevelCache = new HashMap<>();

        // Collections for batch save
        List<EducationLevel> educationLevelsToSave = new ArrayList<>();
        List<LKGradeDerivationMaster> gradeDerivationsToSave = new ArrayList<>();

        // Set to track processed records within this upload
        Set<String> processedRecords = new HashSet<>();

        int educationLevelsCreated = 0;
        int recordsCreated = 0;
        int duplicatesSkipped = 0;
        int invalidRanges = 0;
        int failedRows = 0;

        for (GradeDerivationUploadRowDto row : rows) {
            try {
                // Validate required fields
                if (row.getEducationLevel() == null || row.getEducationLevel().trim().isEmpty() ||
                    row.getDerivedGrade() == null || row.getDerivedGrade().trim().isEmpty() ||
                    row.getMinPriorExp() == null || row.getMinPriorExp().trim().isEmpty() ||
                    row.getMaxPriorExp() == null || row.getMaxPriorExp().trim().isEmpty() ||
                    row.getDerivedStep() == null || row.getDerivedStep().trim().isEmpty()) {
                    log.warn("Skipping row due to missing required fields: {}", row);
                    failedRows++;
                    continue;
                }

                // Parse numeric fields
                int minExpYears;
                int maxExpYears;
                int derivedStep;

                try {
                    minExpYears = Integer.parseInt(row.getMinPriorExp().trim());
                    maxExpYears = Integer.parseInt(row.getMaxPriorExp().trim());
                    derivedStep = Integer.parseInt(row.getDerivedStep().trim());
                } catch (NumberFormatException e) {
                    log.error("Invalid numeric fields in row: {}", row);
                    failedRows++;
                    continue;
                }

                // Validate numeric fields
                if (minExpYears < 0) {
                    log.warn("MinExpYears cannot be negative: {}", row);
                    failedRows++;
                    continue;
                }
                if (maxExpYears < minExpYears) {
                    log.warn("MaxExpYears must be >= MinExpYears: {}", row);
                    failedRows++;
                    continue;
                }
                if (derivedStep <= 0) {
                    log.warn("DerivedStep must be > 0: {}", row);
                    failedRows++;
                    continue;
                }

                // Get or create EducationLevel
                String educationLevelName = row.getEducationLevel().trim();
                EducationLevel educationLevel = educationLevelCache.computeIfAbsent(educationLevelName, name -> {
                    Optional<EducationLevel> existing = educationLevelRepository.findByNameIgnoreCase(name);
                    if (existing.isPresent()) {
                        return existing.get();
                    } else {
                        EducationLevel newLevel = new EducationLevel();
                        newLevel.setName(name);
                        educationLevelRepository.save(newLevel);
                        entityManager.flush();
                        return newLevel;
                    }
                });

                // Check for duplicates within this upload
                String recordKey = educationLevel.getId() + "|" + minExpYears + "|" + maxExpYears;
                if (processedRecords.contains(recordKey)) {
                    duplicatesSkipped++;
                    continue;
                }

                // Check for duplicate in database
                Optional<LKGradeDerivationMaster> existingRecord = gradeDerivationRepository
                        .findByEducationLevelAndMinExpYearsAndMaxExpYears(educationLevel, minExpYears, maxExpYears);
                if (existingRecord.isPresent()) {
                    duplicatesSkipped++;
                    continue;
                }

                // Check for overlapping ranges for same education level
                List<LKGradeDerivationMaster> existingRecords = gradeDerivationRepository.findByEducationLevel(educationLevel);
                boolean hasOverlap = existingRecords.stream().anyMatch(existing ->
                        (minExpYears >= existing.getMinExpYears() && minExpYears <= existing.getMaxExpYears()) ||
                        (maxExpYears >= existing.getMinExpYears() && maxExpYears <= existing.getMaxExpYears()) ||
                        (minExpYears <= existing.getMinExpYears() && maxExpYears >= existing.getMaxExpYears())
                );

                if (hasOverlap) {
                    log.warn("Overlapping experience range for education level {}: {}-{}", educationLevelName, minExpYears, maxExpYears);
                    invalidRanges++;
                    continue;
                }

                // Create LKGradeDerivationMaster
                LKGradeDerivationMaster gradeDerivation = LKGradeDerivationMaster.builder()
                        .educationLevel(educationLevel)
                        .minExpYears(minExpYears)
                        .maxExpYears(maxExpYears)
                        .derivedGrade(row.getDerivedGrade().trim())
                        .derivedStep(derivedStep)
                        .ruleDescription(row.getRuleDescription() != null ? row.getRuleDescription().trim() : null)
                        .build();
                gradeDerivationsToSave.add(gradeDerivation);

                // Mark as processed
                processedRecords.add(recordKey);

            } catch (Exception e) {
                log.error("Error processing row: {}", row, e);
                failedRows++;
            }
        }

        // Batch save grade derivations
        if (!gradeDerivationsToSave.isEmpty()) {
            gradeDerivationRepository.saveAll(gradeDerivationsToSave);
            entityManager.flush();
            recordsCreated = gradeDerivationsToSave.size();
        }

        entityManager.flush();

        return new GradeDerivationUploadResponseDto(rows.size(), educationLevelsCreated, recordsCreated, duplicatesSkipped, invalidRanges, failedRows);
    }
}
