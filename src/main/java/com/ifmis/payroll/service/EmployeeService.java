package com.ifmis.payroll.service;

import com.ifmis.payroll.dto.EmployeeAddressDto;
import com.ifmis.payroll.dto.EmployeeRequestDto;
import com.ifmis.payroll.dto.EmployeeResponseDto;
import com.ifmis.payroll.entity.Employee;
import com.ifmis.payroll.entity.master.*;
import com.ifmis.payroll.exception.DuplicateResourceException;
import com.ifmis.payroll.exception.ResourceNotFoundException;
import com.ifmis.payroll.pojo.EmployeeAddress;
import com.ifmis.payroll.repository.*;
import jakarta.transaction.Transactional;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
@RequiredArgsConstructor
public class EmployeeService {

    private final EmployeeRepository employeeRepository;
    private final EducationLevelRepository educationRepo;
    private final MinistryRepository ministryRepo;
    private final DepartmentRepository departmentRepo;
    private final BankBranchRepository bankRepo;
    private final LKGradeDerivationRepository gradeRepo;
    private final LKLocationMasterRepository locationRepo;

    @Transactional
    public Employee createEmployee(EmployeeRequestDto request) {

        // ================= VALIDATIONS =================

        if (employeeRepository.existsByEmail(request.getEmail())) {
            throw new DuplicateResourceException("Email already exists");
        }

        if (employeeRepository.existsByMobileNumber(request.getMobileNumber())) {
            throw new DuplicateResourceException("Mobile number already exists");
        }

        if (employeeRepository.existsByCivilServiceCardId(request.getCivilServiceCardId())) {
            throw new DuplicateResourceException("Civil Service Card ID already exists");
        }

        if (employeeRepository.existsBySocialSecurityNumber(request.getSocialSecurityNumber())) {
            throw new DuplicateResourceException("Social Security Number already exists");
        }

        if (employeeRepository.existsByAccountNumber(request.getAccountNumber())) {
            throw new DuplicateResourceException("Bank account already exists");
        }

        // ================= MASTER FETCH =================

        EducationLevel education = educationRepo.findById(request.getEducationLevelId())
                .orElseThrow(() -> new ResourceNotFoundException("Education level not found"));

        Ministry ministry = ministryRepo.findById(request.getMinistryId())
                .orElseThrow(() -> new ResourceNotFoundException("Ministry not found"));

        Department department = departmentRepo.findById(request.getDepartmentId())
                .orElseThrow(() -> new ResourceNotFoundException("Department not found"));

        BankBranch branch = bankRepo.findById(request.getBranchId())
                .orElseThrow(() -> new ResourceNotFoundException("Bank branch not found"));

        // ================= GRADE DERIVATION =================
        int experience = request.getPriorExperience() == null ? 0 : request.getPriorExperience();

        LKGradeDerivationMaster grade = gradeRepo
                .findByEducationLevelIdAndMinExpYearsLessThanEqualAndMaxExpYearsGreaterThanEqual(
                        request.getEducationLevelId(),
                        experience,
                        experience
                )
                .orElseThrow(() -> new ResourceNotFoundException("Grade rule not found"));

        // ================= LOCATION MASTER FETCH =================

        String countryKey = request.getCountryKey();


        if ("Lao PDR".equalsIgnoreCase(countryKey)) {
            countryKey = "LAO";
        }else{
            countryKey = "FOR";
        }
        LKLocationMaster location = locationRepo
                .findByCountry_CountryKeyAndProvince_ProvinceKeyAndDistrict_DistrictKey(
                        countryKey,
                        request.getProvinceKey(),
                        request.getDistrictKey()
                )
                .orElseThrow(() -> new ResourceNotFoundException("Invalid location combination"));

        // ================= JSONB ADDRESS =================

        EmployeeAddress address = mapAddress(request.getAddress());

        // ================= BUILD ENTITY =================

        Employee employee = Employee.builder()
                .employeeCode(request.getEmployeeCode())

                // Personal
                .title(request.getTitle())
                .firstName(request.getFirstName())
                .lastName(request.getLastName())
                .gender(request.getGender())
                .dateOfBirth(request.getDateOfBirth())
                .email(request.getEmail())
                .mobileNumber(request.getMobileNumber())

                // Service
                .dateOfJoining(request.getDateOfJoining())

                // Employment
                .employmentType(request.getEmploymentType())
                .position(request.getPosition())
                .educationLevel(education)
                .priorExperience(request.getPriorExperience())
                .gradeAndStep(grade)

                // Identity
                .civilServiceCardId(request.getCivilServiceCardId())
                .socialSecurityNumber(request.getSocialSecurityNumber())

                // Organization
                .ministry(ministry)
                .department(department)
                .division(request.getDivision())

                // Service Location
                .location(location)

                // JSONB
                .address(address)

                // Bank
                .branch(branch)
                .accountNumber(request.getAccountNumber())

                // Flags
                .hasSpouse(request.getHasSpouse())
                .noOfEligibleChildren(request.getNoOfEligibleChildren())

                .build();

        return employeeRepository.save(employee);
    }

//    public Page<Employee> getAllEmployees(Pageable pageable) {
//        Page<Employee> employees = employeeRepository.findAll(pageable);
//        return employees;
//    }

    public Page<EmployeeResponseDto> getAllEmployees(Pageable pageable) {
        return employeeRepository.findAll(pageable)
                .map(this::convertToDto);
    }

    // ================= HELPER METHODS =================

    private EmployeeAddress mapAddress(EmployeeAddressDto dto) {
        if (dto == null) return null;

        return new EmployeeAddress(
                dto.getHouseNo(),
                dto.getStreet(),
                dto.getArea(),
                dto.getProvinceOfResidence(),
                dto.getPinCode(),
                dto.getCountry()
        );
    }

    private EmployeeResponseDto convertToDto(Employee e) {
        return EmployeeResponseDto.builder()
                // PRIMARY
                .employeeCode(e.getEmployeeCode())

                // PERSONAL
                .title(e.getTitle())
                .firstName(e.getFirstName())
                .lastName(e.getLastName())
                .gender(e.getGender())
                .dateOfBirth(e.getDateOfBirth())
                .email(e.getEmail())
                .mobileNumber(e.getMobileNumber())

                // SERVICE DATES
                .dateOfJoining(e.getDateOfJoining())
                .yearsOfService(e.getYearOfService())
                .dateOfRetirement(e.getDateOfRetirement())

                // EMPLOYMENT
                .employmentType(e.getEmploymentType())
                .position(e.getPosition())

                .educationLevelId(
                        e.getEducationLevel() != null ? e.getEducationLevel().getId() : null
                )
                .educationLevelName(
                        e.getEducationLevel() != null ? e.getEducationLevel().getName() : null
                )

                .priorExperience(e.getPriorExperience())

                .grade(
                        e.getGradeAndStep() != null ? Integer.parseInt(e.getGradeAndStep().getDerivedGrade()) : null
                )
                .step(
                        e.getGradeAndStep() != null ? e.getGradeAndStep().getDerivedStep() : null
                )

                // IDENTITY
                .civilServiceCardId(e.getCivilServiceCardId())
                .socialSecurityNumber(e.getSocialSecurityNumber())

                // ORGANIZATION
                .ministryId(
                        e.getMinistry() != null ? e.getMinistry().getMinistryKey().toString() : null
                )
                .ministryName(
                        e.getMinistry() != null ? e.getMinistry().getName() : null
                )

                .departmentId(
                        e.getDepartment() != null ? e.getDepartment().getDepartmentKey().toString() : null
                )
                .departmentName(
                        e.getDepartment() != null ? e.getDepartment().getName() : null
                )

                .division(e.getDivision())

                // LOCATION
                .countryKey(
                        e.getLocation() != null ? e.getLocation().getCountry().getCountryKey() : null
                )
                .countryName(
                        e.getLocation() != null ? e.getLocation().getCountry().getName() : null
                )

                .provinceKey(
                        e.getLocation() != null ? e.getLocation().getProvince().getProvinceKey() : null
                )
                .provinceName(
                        e.getLocation() != null ? e.getLocation().getProvince().getName() : null
                )

                .districtKey(
                        e.getLocation() != null ? e.getLocation().getDistrict().getDistrictKey() : null
                )
                .districtName(
                        e.getLocation() != null ? e.getLocation().getDistrict().getName() : null
                )

                .professionalCategory(e.getProfessionCategory())

                .isRemoteArea(
                        e.getLocation() != null ? e.getLocation().getIsRemote() : null
                )
                .isHazardousArea(
                        e.getLocation() != null ? e.getLocation().getIsHazardous() : null
                )
                .isForeignPosting(
                        e.getLocation() != null ? e.getLocation().getIsForeignPosting() : null
                )

                // ADDRESS
                .address(
                        e.getAddress() != null
                                ? EmployeeAddressDto.builder()
                                .street(e.getAddress().getStreet())
                                .area(e.getAddress().getArea())
                                .houseNo(e.getAddress().getHouseNo())
                                .pinCode(e.getAddress().getPinCode())
                                .provinceOfResidence(e.getAddress().getProvinceOfResidence())
                                .build()
                                : null
                )

                // BANK
                .branchId(
                        e.getBranch() != null ? e.getBranch().getId() : null
                )
                .bankName(
                        e.getBranch() != null ? e.getBranch().getBank().getBankName() : null
                )
                .branchName(
                        e.getBranch() != null ? e.getBranch().getBranchName() : null
                )
                .branchCode(
                        e.getBranch() != null ? e.getBranch().getBranchCode() : null
                )
                .swiftCode(
                        e.getBranch() != null ? e.getBranch().getSwiftBICCode() : null
                )

                .accountNumber(e.getAccountNumber())

                // FLAGS
                .hasSpouse(e.getHasSpouse())
                .noOfEligibleChildren(e.getNoOfEligibleChildren())
                .positionLevel(e.getPositionLevel())

                .build();
    }

}
