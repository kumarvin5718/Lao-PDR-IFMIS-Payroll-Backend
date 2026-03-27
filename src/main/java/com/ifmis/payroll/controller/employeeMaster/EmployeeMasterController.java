package com.ifmis.payroll.controller.employeeMaster;

import com.ifmis.payroll.dto.EmployeeRequestDto;
import com.ifmis.payroll.dto.EmployeeResponseDto;
import com.ifmis.payroll.service.employeeMaster.EmployeeMasterService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/employee")
@RequiredArgsConstructor
public class EmployeeMasterController {

    private final EmployeeMasterService employeeMasterService;

    @PostMapping
    public ResponseEntity<EmployeeResponseDto> createEmployee(
            @RequestBody EmployeeRequestDto request) {

        EmployeeResponseDto response = employeeMasterService.createEmployee(request);

        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }
}