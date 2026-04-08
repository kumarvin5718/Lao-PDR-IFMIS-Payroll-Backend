package com.ifmis.payroll.service;

import com.ifmis.payroll.dto.LocationUploadResponseDto;
import com.ifmis.payroll.dto.LocationUploadRowDto;
import com.ifmis.payroll.entity.master.*;
import com.ifmis.payroll.repository.*;
import com.ifmis.payroll.util.LocationFileParser;
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
public class LocationUploadService {

    private final CountryRepository countryRepository;
    private final ProvinceRepository provinceRepository;
    private final DistrictRepository districtRepository;
    private final LKLocationMasterRepository lkLocationMasterRepository;
    private final LocationFileParser locationFileParser;

    // Injecting EntityManager for batch processing
    @PersistenceContext
    private EntityManager entityManager;

    // Assuming LAO is the local country key
    private static final String LOCAL_COUNTRY_KEY = "LAO";

    @Transactional
    public LocationUploadResponseDto uploadLocations(MultipartFile file) {
        List<LocationUploadRowDto> rows;
        try {
            rows = locationFileParser.parseFile(file);
        } catch (IOException e) {
            log.error("Error parsing file", e);
            throw new RuntimeException("Failed to parse file", e);
        }

        // Caches
        Map<String, Country> countryCache = new HashMap<>();
        Map<String, Province> provinceCache = new HashMap<>();
        Map<String, District> districtCache = new HashMap<>();

        // Set to track processed location combinations within this upload
        Set<String> processedLocations = new HashSet<>();

        // Collections for batch save
        List<Country> countriesToSave = new ArrayList<>();
        List<Province> provincesToSave = new ArrayList<>();
        List<District> districtsToSave = new ArrayList<>();
        List<LKLocationMaster> locationsToSave = new ArrayList<>();

        int countriesCreated = 0;
        int provincesCreated = 0;
        int districtsCreated = 0;
        int locationsCreated = 0;
        int duplicatesSkipped = 0;
        int failedRows = 0;

        for (LocationUploadRowDto row : rows) {
            try {
                // Validate required fields
                if (row.getCountryKey() == null || row.getCountryKey().trim().isEmpty() ||
                    row.getProvinceKey() == null || row.getProvinceKey().trim().isEmpty() ||
                    row.getDistrictKey() == null || row.getDistrictKey().trim().isEmpty()) {
                    log.warn("Skipping row due to missing required fields: {}", row);
                    failedRows++;
                    continue;
                }

                // Get or create Country
                String countryName = row.getCountry() != null ? row.getCountry().trim() : row.getCountryKey().trim();
                Country country = countryCache.computeIfAbsent(countryName, name -> {
                    Optional<Country> existing = countryRepository.findByName(name);
                    if (existing.isPresent()) {
                        return existing.get();
                    } else {
                        Country newCountry = new Country();
                        newCountry.setCountryKey(row.getCountryKey().trim());
                        newCountry.setName(name);
                        countriesToSave.add(newCountry);
                        return newCountry;
                    }
                });

                // Get or create Province
                String provinceName = row.getProvincePosting() != null ? row.getProvincePosting().trim() : row.getProvinceKey().trim();
                Province province = provinceCache.computeIfAbsent(provinceName, name -> {
                    Optional<Province> existing = provinceRepository.findByName(name);
                    if (existing.isPresent()) {
                        return existing.get();
                    } else {
                        Province newProvince = new Province();
                        newProvince.setProvinceKey(row.getProvinceKey().trim());
                        newProvince.setName(name);
                        newProvince.setCountry(country);
                        provincesToSave.add(newProvince);
                        return newProvince;
                    }
                });

                // Get or create District
                String districtName = row.getDistrict() != null ? row.getDistrict().trim() : row.getDistrictKey().trim();
                District district = districtCache.computeIfAbsent(districtName, name -> {
                    Optional<District> existing = districtRepository.findByName(name);
                    if (existing.isPresent()) {
                        return existing.get();
                    } else {
                        District newDistrict = new District();
                        newDistrict.setDistrictKey(row.getDistrictKey().trim());
                        newDistrict.setName(name);
                        newDistrict.setProvince(province);
                        districtsToSave.add(newDistrict);
                        return newDistrict;
                    }
                });

                // Check if LKLocationMaster already exists in this upload
                String locationKey = row.getCountryKey().trim() + "|" + row.getProvinceKey().trim() + "|" + row.getDistrictKey().trim();
                if (processedLocations.contains(locationKey)) {
                    duplicatesSkipped++;
                    continue;
                }

                // Check if LKLocationMaster already exists in DB
                Optional<LKLocationMaster> existingLocation = lkLocationMasterRepository
                        .findByCountry_CountryKeyAndProvince_ProvinceKeyAndDistrict_DistrictKey(
                                row.getCountryKey().trim(),
                                row.getProvinceKey().trim(),
                                row.getDistrictKey().trim()
                        );
                if (existingLocation.isPresent()) {
                    duplicatesSkipped++;
                    continue;
                }

                // Parse booleans
                Boolean isRemote = parseBoolean(row.getIsRemote());
                Boolean isHazardous = parseBoolean(row.getIsHazardous());
                Boolean isForeignPosting = !LOCAL_COUNTRY_KEY.equals(row.getCountryKey().trim());

                // Create LKLocationMaster
                LKLocationMaster location = new LKLocationMaster();
                location.setCountry(country);
                location.setProvince(province);
                location.setDistrict(district);
                location.setIsRemote(isRemote);
                location.setIsHazardous(isHazardous);
                location.setIsForeignPosting(isForeignPosting);
                location.setNotes(row.getNotes() != null ? row.getNotes().trim() : null);
                locationsToSave.add(location);

                // Mark as processed
                processedLocations.add(locationKey);

            } catch (Exception e) {
                log.error("Error processing row: {}", row, e);
                failedRows++;
            }
        }

        // Batch save
        if (!countriesToSave.isEmpty()) {
            countryRepository.saveAll(countriesToSave);
            entityManager.flush();
            countriesCreated = countriesToSave.size();
        }
        if (!provincesToSave.isEmpty()) {
            provinceRepository.saveAll(provincesToSave);
            entityManager.flush();
            provincesCreated = provincesToSave.size();
        }
        if (!districtsToSave.isEmpty()) {
            districtRepository.saveAll(districtsToSave);
            entityManager.flush();
            districtsCreated = districtsToSave.size();
        }
        if (!locationsToSave.isEmpty()) {
            lkLocationMasterRepository.saveAll(locationsToSave);
            entityManager.flush();
            locationsCreated = locationsToSave.size();
        }

        // Flush the EntityManager to ensure all changes are persisted
        entityManager.flush();

        return new LocationUploadResponseDto(rows.size(), countriesCreated, provincesCreated, districtsCreated, locationsCreated, duplicatesSkipped, failedRows);
    }

    private Boolean parseBoolean(String value) {
        if (value == null || value.trim().isEmpty()) {
            return false;
        }
        String trimmed = value.trim().toLowerCase();
        return "yes".equals(trimmed) || "true".equals(trimmed);
    }
}
