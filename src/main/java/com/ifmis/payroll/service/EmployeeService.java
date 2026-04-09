package com.ifmis.payroll.service;

import com.ifmis.payroll.dto.EmployeeAddressDto;
import com.ifmis.payroll.dto.EmployeeRequestDto;
import com.ifmis.payroll.entity.Employee;
import com.ifmis.payroll.entity.master.*;
import com.ifmis.payroll.exception.DuplicateResourceException;
import com.ifmis.payroll.exception.ResourceNotFoundException;
import com.ifmis.payroll.pojo.EmployeeAddress;
import com.ifmis.payroll.repository.*;
import jakarta.transaction.Transactional;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

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

        LKLocationMaster location = locationRepo
                .findByCountry_CountryKeyAndProvince_ProvinceKeyAndDistrict_DistrictKey(
                        request.getCountryKey(),
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
//                .professionCategory()

                // JSONB
                .address(address)

                // Bank
                .branch(branch)
                .accountNumber(request.getAccountNumber())

                // Flags
                .hasSpouse(request.getHasSpouse())
                .noOfEligibleChildren(request.getNoOfEligibleChildren())
//                .positionLevel())
//                .isNAMember()
//                .fieldAllowanceType()

                .build();

        return employeeRepository.save(employee);
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

}
