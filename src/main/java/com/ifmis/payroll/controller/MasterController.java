package com.ifmis.payroll.controller;

import com.ifmis.payroll.dto.BankDto;
import com.ifmis.payroll.entity.master.*;
import com.ifmis.payroll.repository.*;
import com.ifmis.payroll.enums.EmploymentType;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Arrays;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@RestController
@RequestMapping("/api/master")
@RequiredArgsConstructor
public class MasterController {

    private final MinistryRepository ministryRepository;
    private final DepartmentRepository departmentRepository;
    private final EducationLevelRepository educationLevelRepository;
    private final BankBranchRepository bankBranchRepository;
    private final LKLocationMasterRepository lkLocationMasterRepository;
    private final CountryRepository countryRepository;
    private final ProvinceRepository provinceRepository;
    private final DistrictRepository districtRepository;
    private final LKBankMasterRepository lkBankMasterRepository;

    // ================= ENUMS =================

    @GetMapping("/employment-types")
    public ResponseEntity<List<String>> getAllEmploymentTypes() {
        List<String> types = Arrays.stream(EmploymentType.values())
                .map(Enum::name)
                .toList();
        return ResponseEntity.ok(types);
    }

    // ================= ORGANIZATION =================

    @GetMapping("/ministries")
    public ResponseEntity<List<Ministry>> getAllMinistries() {
        List<Ministry> ministries = ministryRepository.findAll();
        return ResponseEntity.ok(ministries);
    }

    @GetMapping("/departments")
    public ResponseEntity<List<Department>> getAllDepartments() {
        List<Department> departments = departmentRepository.findAll();
        return ResponseEntity.ok(departments);
    }

    // ================= EDUCATION =================

    @GetMapping("/education-levels")
    public ResponseEntity<List<EducationLevel>> getAllEducationLevels() {
        List<EducationLevel> educationLevels = educationLevelRepository.findAll();
        return ResponseEntity.ok(educationLevels);
    }

    // ================= BANKING =================

    @GetMapping("/banks")
    public ResponseEntity<List<BankDto>> getAllBanks() {
        List<BankDto> banks = lkBankMasterRepository.findAll().stream()
                .map(bank -> BankDto.builder()
                        .id(bank.getId())
                        .bankName(bank.getBankName())
                        .build())
                .toList();
        return ResponseEntity.ok(banks);
    }

    @GetMapping("/banks/{bankId}/branches")
    public ResponseEntity<List<BankBranch>> getBranchesByBank(@PathVariable UUID bankId) {
        List<BankBranch> branches = bankBranchRepository.findAll().stream()
                .filter(b -> b.getBank().getId().equals(bankId))
                .toList();
        return ResponseEntity.ok(branches);
    }

    @GetMapping("/banks/branches")
    public ResponseEntity<List<BankBranch>> getAllBankBranches() {
        List<BankBranch> branches = bankBranchRepository.findAll();
        return ResponseEntity.ok(branches);
    }

    // ================= LOCATIONS (HIERARCHICAL) =================

    @GetMapping("/countries")
    public ResponseEntity<List<Country>> getAllCountries() {
        List<Country> countries = countryRepository.findAll();
        return ResponseEntity.ok(countries);
    }

    @GetMapping("/countries/{countryId}/provinces")
    public ResponseEntity<List<Province>> getProvincesByCountry(@PathVariable String countryId) {
        List<Province> provinces = provinceRepository.findAll().stream()
                .filter(p -> p.getCountry().getCountryKey().equals(countryId))
                .toList();
        return ResponseEntity.ok(provinces);
    }

    @GetMapping("/provinces")
    public ResponseEntity<List<Province>> getAllProvinces() {
        List<Province> provinces = provinceRepository.findAll();
        return ResponseEntity.ok(provinces);
    }

    @GetMapping("/provinces/{provinceId}/districts")
    public ResponseEntity<List<District>> getDistrictsByProvince(@PathVariable String provinceId) {
        List<District> districts = districtRepository.findAll().stream()
                .filter(d -> d.getProvince().getProvinceKey().equals(provinceId))
                .toList();
        return ResponseEntity.ok(districts);
    }

    @GetMapping("/districts")
    public ResponseEntity<List<District>> getAllDistricts() {
        List<District> districts = districtRepository.findAll();
        return ResponseEntity.ok(districts);
    }

    @GetMapping("/locations")
    public ResponseEntity<List<LKLocationMaster>> getAllLocations() {
        List<LKLocationMaster> locations = lkLocationMasterRepository.findAll();
        return ResponseEntity.ok(locations);
    }

    @GetMapping("/locations/{countryKey}/{provinceKey}/{districtKey}")
    public ResponseEntity<LKLocationMaster> getLocationByKeys(
            @PathVariable String countryKey,
            @PathVariable String provinceKey,
            @PathVariable String districtKey) {
        Optional<LKLocationMaster> location = lkLocationMasterRepository
                .findByCountry_CountryKeyAndProvince_ProvinceKeyAndDistrict_DistrictKey(countryKey, provinceKey, districtKey);
        return location.map(ResponseEntity::ok).orElse(ResponseEntity.notFound().build());
    }
}
