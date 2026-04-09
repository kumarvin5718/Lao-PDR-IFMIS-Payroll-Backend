package com.ifmis.payroll.controller.employeeMaster;

import com.ifmis.payroll.dto.EmployeeRequestDto;
import com.ifmis.payroll.dto.EmployeeResponseDto;
import com.ifmis.payroll.entity.Employee;
import com.ifmis.payroll.service.EmployeeService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/employees")
@RequiredArgsConstructor
public class EmployeeMasterController {

    private final EmployeeService employeeService;

    @PostMapping
    public ResponseEntity<String> createEmployee(@Valid @RequestBody EmployeeRequestDto request) {
        Employee employee = employeeService.createEmployee(request);
        return ResponseEntity.ok("Employee created successfully with ID: " + employee.getEmployeeCode());
    }

    @GetMapping
    public ResponseEntity<?> getAllEmployees(Pageable pageable) {
        Page<EmployeeResponseDto> employees = employeeService.getAllEmployees(pageable);
        return ResponseEntity.ok(employees);
    }
}