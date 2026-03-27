package com.ifmis.payroll.service.employeeMaster.Impl;

import com.ifmis.payroll.dto.EmployeeRequestDto;
import com.ifmis.payroll.dto.EmployeeResponseDto;
import com.ifmis.payroll.entity.EmployeePersonalInformation;
import com.ifmis.payroll.enums.Gender;
import com.ifmis.payroll.enums.Title;
import com.ifmis.payroll.repository.EmployeeMasterRepository;
import com.ifmis.payroll.service.employeeMaster.EmployeeMasterService;
import jakarta.transaction.Transactional;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.Period;
import java.time.format.DateTimeFormatter;

@Service
@RequiredArgsConstructor
@Transactional
public class EmployeeMasterServiceImpl implements EmployeeMasterService {

    private final EmployeeMasterRepository employeeMasterRepository;

    @Override
    public EmployeeResponseDto createEmployee(EmployeeRequestDto request) {

        // Duplicate check
        if (employeeMasterRepository.existsById(request.getEmployeeCode())) {
            throw new IllegalArgumentException("Employee already exists with code: " + request.getEmployeeCode());
        }

        //  Title parse (Mr. → MR)
        Title title;
        try {
            title = Title.valueOf(
                    request.getTitle().replace(".", "").trim().toUpperCase()
            );
        } catch (Exception e) {
            title = Title.MR; // default
        }

        //  Gender parse
        Gender gender;
        try {
            gender = Gender.valueOf(request.getGender().trim().toUpperCase());
        } catch (Exception e) {
            throw new IllegalArgumentException("Invalid gender: " + request.getGender());
        }

        //  Date Formatter (IMPORTANT )
        DateTimeFormatter formatter = DateTimeFormatter.ofPattern("dd-MM-yyyy");

        LocalDate dob;
        LocalDate doj;

        try {
            dob = LocalDate.parse(request.getDateOfBirth().trim(), formatter);
            doj = LocalDate.parse(request.getDateOfJoining().trim(), formatter);
        } catch (Exception e) {
            throw new IllegalArgumentException("Date format must be dd-MM-yyyy");
        }

        //  Derived fields
        int yearsOfService = (!doj.isAfter(LocalDate.now()))
                ? Period.between(doj, LocalDate.now()).getYears()
                : 0;

        LocalDate retirementDate = dob.plusYears(60);

        // Save entity
        EmployeePersonalInformation entity = EmployeePersonalInformation.builder()
                .employeeCode(request.getEmployeeCode().trim())
                .titles(title)
                .firstName(request.getFirstName().trim())
                .lastName(request.getLastName().trim())
                .gender(gender)
                .dateOfBirth(dob)
                .email(request.getEmail().trim())
                .mobileNumber(request.getMobileNumber().trim())
                .dateOfJoining(doj)
                .yearOfService(yearsOfService)
                .dateOfRetirement(retirementDate)
                .build();

        EmployeePersonalInformation saved = employeeMasterRepository.save(entity);

        // Response Formatter (output nice format)
        DateTimeFormatter outputFormatter = DateTimeFormatter.ofPattern("dd-MMM-yyyy");

        return EmployeeResponseDto.builder()
                .employeeCode(saved.getEmployeeCode())
                .title(saved.getTitles() != null ? saved.getTitles().name() : null)
                .firstName(saved.getFirstName())
                .lastName(saved.getLastName())
                .gender(saved.getGender().name())
                .dateOfBirth(saved.getDateOfBirth().format(outputFormatter))
                .email(saved.getEmail())
                .mobileNumber(saved.getMobileNumber())
                .dateOfJoining(saved.getDateOfJoining().format(outputFormatter))
                .yearOfService(saved.getYearOfService())
                .dateOfRetirement(saved.getDateOfRetirement().format(outputFormatter))
                .build();
    }
}


