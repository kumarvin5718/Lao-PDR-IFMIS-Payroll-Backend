package com.ifmis.payroll.service;

import com.ifmis.payroll.dto.BankUploadResponseDto;
import com.ifmis.payroll.dto.BankUploadRowDto;
import com.ifmis.payroll.entity.master.BankBranch;
import com.ifmis.payroll.entity.master.BankCategory;
import com.ifmis.payroll.entity.master.LKBankMaster;
import com.ifmis.payroll.repository.BankBranchRepository;
import com.ifmis.payroll.repository.BankCategoryRepository;
import com.ifmis.payroll.repository.LKBankMasterRepository;
import com.ifmis.payroll.util.BankFileParser;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.util.*;

@Service
@RequiredArgsConstructor
@Slf4j
public class BankUploadService {

    private final BankCategoryRepository bankCategoryRepository;
    private final LKBankMasterRepository lkBankMasterRepository;
    private final BankBranchRepository bankBranchRepository;
    private final BankFileParser bankFileParser;

    @Transactional
    public BankUploadResponseDto uploadBanks(MultipartFile file) {
        // Parse file
        List<BankUploadRowDto> rows = parseFile(file);

        // Caches
        Map<String, BankCategory> categoryCache = new HashMap<>();
        Map<String, LKBankMaster> bankCache = new HashMap<>();

        // Collections for batch save
        List<BankCategory> categoriesToSave = new ArrayList<>();
        List<LKBankMaster> banksToSave = new ArrayList<>();
        List<BankBranch> branchesToSave = new ArrayList<>();

        int categoriesCreated = 0;
        int banksCreated = 0;
        int branchesCreated = 0;
        int duplicatesSkipped = 0;

        for (BankUploadRowDto row : rows) {
            try {
                // Validate required fields
                if (row.getBankName() == null || row.getBankName().trim().isEmpty() ||
                    row.getCategory() == null || row.getCategory().trim().isEmpty() ||
                    row.getBranchName() == null || row.getBranchName().trim().isEmpty()) {
                    log.warn("Skipping row due to missing required fields: {}", row);
                    continue;
                }

                // Get or create category
                BankCategory category = categoryCache.computeIfAbsent(row.getCategory().trim(), name -> {
                    Optional<BankCategory> existing = bankCategoryRepository.findByName(name);
                    if (existing.isPresent()) {
                        return existing.get();
                    } else {
                        BankCategory newCategory = BankCategory.builder().name(name).build();
                        categoriesToSave.add(newCategory);
                        return newCategory;
                    }
                });

                // Get or create bank
                LKBankMaster bank = bankCache.computeIfAbsent(row.getBankKey().trim(), key -> {
                    Optional<LKBankMaster> existing = lkBankMasterRepository.findByBankKey(key);
                    if (existing.isPresent()) {
                        return existing.get();
                    } else {
                        LKBankMaster newBank = LKBankMaster.builder()
                                .bankName(row.getBankName().trim())
                                .abbrev(row.getAbbrev() != null ? row.getAbbrev().trim() : null)
                                .bankKey(key)
                                .bankCategory(category)
                                .telephone(row.getTelephone() != null ? row.getTelephone().trim() : null)
                                .ownership(row.getOwnership() != null ? row.getOwnership().trim() : null)
                                .establishedYear(row.getEstablished())
                                .website(row.getWebsite() != null ? row.getWebsite().trim() : null)
                                .build();
                        banksToSave.add(newBank);
                        return newBank;
                    }
                });

                // Check if branch exists
                if (row.getBranchCode() != null && !row.getBranchCode().trim().isEmpty()) {
                    Optional<BankBranch> existingBranch = bankBranchRepository.findByBranchCode(row.getBranchCode().trim());
                    if (existingBranch.isPresent()) {
                        duplicatesSkipped++;
                        continue;
                    }
                }

                // Create branch
                BankBranch branch = BankBranch.builder()
                        .branchName(row.getBranchName().trim())
                        .branchCode(row.getBranchCode() != null ? row.getBranchCode().trim() : null)
                        .city(row.getCity() != null ? row.getCity().trim() : null)
                        .swiftBICCode(row.getSwiftBICCode() != null ? row.getSwiftBICCode().trim() : null)
                        .branchAddress(row.getBranchAddress() != null ? row.getBranchAddress().trim() : null)
                        .bankHQAddress(row.getBankHQAddress() != null ? row.getBankHQAddress().trim() : null)
                        .bank(bank)
                        .build();
                branchesToSave.add(branch);

            } catch (Exception e) {
                log.error("Error processing row: {}", row, e);
            }
        }

        // Batch save
        if (!categoriesToSave.isEmpty()) {
            bankCategoryRepository.saveAll(categoriesToSave);
            categoriesCreated = categoriesToSave.size();
        }
        if (!banksToSave.isEmpty()) {
            lkBankMasterRepository.saveAll(banksToSave);
            banksCreated = banksToSave.size();
        }
        if (!branchesToSave.isEmpty()) {
            bankBranchRepository.saveAll(branchesToSave);
            branchesCreated = branchesToSave.size();
        }

        return new BankUploadResponseDto(rows.size(), banksCreated, categoriesCreated, branchesCreated, duplicatesSkipped);
    }

    private List<BankUploadRowDto> parseFile(MultipartFile file) {
        // This will be injected or called from util
        // For now, assume we have the parser
        try {
            return bankFileParser.parseFile(file);
        } catch (Exception e) {
            log.error("Error parsing file", e);
            return Collections.emptyList();
        }
    }
}
